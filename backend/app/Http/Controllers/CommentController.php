<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;
use App\Services\PushService;

class CommentController extends Controller
{
    public function __construct(
        private SupabaseService $supabase,
        private PushService     $push,
    ) {}

    public function index(string $id): JsonResponse
    {
        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        if (!($card['comments_enabled'] ?? true)) {
            return response()->json([]);
        }

        $comments = $this->supabase->getComments($id);
        return response()->json($comments);
    }

    public function store(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;

        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        if (!($card['comments_enabled'] ?? true)) {
            return response()->json(['error' => 'Comments are disabled for this verse.'], 403);
        }

        $data = $request->validate([
            'body'      => 'required|string|max:500',
            'parent_id' => 'nullable|uuid',
            'reply_to'  => 'nullable|string|max:100',
        ]);

        $profile = $this->supabase->getProfile($user['id']);

        $comment = $this->supabase->insertComment([
            'card_id'    => $id,
            'user_id'    => $user['id'],
            'author'     => $profile['display_name'] ?? $profile['username'] ?? $user['email'],
            'body'       => $data['body'],
            'avatar_url' => $profile['avatar_url'] ?? null,
            'parent_id'  => $data['parent_id'] ?? null,
            'reply_to'   => $data['reply_to'] ?? null,
        ]);

        $commenterName   = $profile['display_name'] ?? $profile['username'] ?? 'Someone';
        $commenterAvatar = $profile['avatar_url'] ?? null;
        $preview         = mb_substr($data['body'], 0, 100);

        // ── Push: reply → notify parent comment author ─────────────────────────
        if (!empty($data['parent_id'])) {
            try {
                $parent = $this->supabase->getCommentById($data['parent_id']);
                if ($parent && $parent['user_id'] !== $user['id']) {
                    $this->push->sendToUser(
                        $parent['user_id'],
                        "{$commenterName} 💬",
                        "Replied to your comment: {$preview}",
                        '/',
                        'reply-' . $data['parent_id'],
                        $commenterAvatar
                    );
                }
            } catch (\Throwable) {}
        }

        // ── Push: top-level comment → notify card owner ────────────────────────
        if (empty($data['parent_id']) && ($card['author_id'] ?? null) && $card['author_id'] !== $user['id']) {
            try {
                $this->push->sendToUser(
                    $card['author_id'],
                    "{$commenterName} 📝",
                    "Commented on your verses: {$preview}",
                    '/',
                    'comment-' . $id,
                    $commenterAvatar
                );
            } catch (\Throwable) {}
        }

        return response()->json($comment, 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->supabase->deleteComment($id);
        return response()->json(['message' => 'Deleted']);
    }
}
