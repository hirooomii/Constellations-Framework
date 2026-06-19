<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class CommentController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

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

        return response()->json($comment, 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->supabase->deleteComment($id);
        return response()->json(['message' => 'Deleted']);
    }
}