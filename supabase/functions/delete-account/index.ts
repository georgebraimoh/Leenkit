// Deletes the signed-in user's account.
//
// - Cancels Hangouts they host (attendees notified, paid tickets flagged for
//   refund), leaves Hangouts they joined, removes follows/notifications,
//   payout details and uploaded photos.
// - No payment history: the auth user is deleted and everything cascades.
// - Payment history (as buyer or host): records are kept for accounting, the
//   profile is anonymised and the login is soft-deleted so it can't sign in.
//
// POST { confirm: "DELETE" }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, json, requireUser } from "../_shared/http.ts";

async function removeFolder(admin: ReturnType<typeof adminClient>, bucket: string, userId: string) {
  const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  const paths = (files || []).map((f) => `${userId}/${f.name}`);
  if (paths.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) console.error(`Could not remove ${bucket} files:`, error.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    if (!user) return json(req, { error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return json(req, { error: 'Type DELETE to confirm.' }, 400);
    }

    const admin = adminClient();

    // Every step below is safe to repeat: prepare_account_deletion() only
    // removes/anonymises what is still there, storage removal ignores missing
    // files, and deleteUser on an already-deleted user fails harmlessly. So a
    // failure part-way through is fixed by simply retrying.
    const { data: result, error: prepError } = await admin.rpc("prepare_account_deletion", { p_user_id: user.id });
    if (prepError) {
      console.error("delete-account prepare failed:", prepError.message);
      return json(req, { error: "We could not delete your account. Nothing was deleted; please try again." }, 500);
    }

    const hasPayments = Boolean(result?.has_payments);

    await removeFolder(admin, "profile-images", user.id);
    // Hangouts with payments are kept (shown as hosted by a deleted member),
    // so their cover images must stay. Without payments every Hangout the
    // user hosted is deleted with the account, so its images go too.
    if (!hasPayments) {
      await removeFolder(admin, "hangout-images", user.id);
    }

    // Soft delete keeps the auth row (so payment records stay valid) but
    // scrambles the email and blocks sign-in.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, hasPayments);
    if (deleteError) {
      console.error("delete-account auth deletion failed:", deleteError.message);
      return json(req, {
        error: "Your account was only partly deleted. Please try again; you will not lose anything by retrying.",
        partial: true,
      }, 500);
    }

    return json(req, {
      deleted: true,
      anonymised: hasPayments,
      cancelled_hangouts: result?.cancelled_hangouts ?? 0,
    });
  } catch (err: any) {
    console.error("delete-account error:", err?.message || err);
    return json(req, { error: err?.message || "Could not delete your account. Please try again." }, 500);
  }
});
