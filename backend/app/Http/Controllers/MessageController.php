<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class MessageController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $conversations = $this->supabase->getConversations($user['id']);
        return response()->json(['conversations' => $conversations]);
    }

    public function open(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate(['user_id' => 'required|string']);

        if ($data['user_id'] === $user['id']) {
            return response()->json(['error' => 'Cannot message yourself'], 422);
        }

        $conversation = $this->supabase->getOrCreateConversation($user['id'], $data['user_id']);
        return response()->json($conversation);
    }

    public function messages(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $participations = $this->supabase->getUserConversationIds($user['id']);
        if (!in_array($id, $participations)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $messages = $this->supabase->getMessages($id);
        return response()->json(['messages' => $messages]);
    }

    public function send(Request $request, string $id): JsonResponse
    {
        $user    = $request->supabaseUser;
        $data    = $request->validate(['body' => 'required|string|max:1000']);
        $profile = $this->supabase->getProfile($user['id']);

        $message = $this->supabase->insertMessage([
            'conversation_id' => $id,
            'sender_id'       => $user['id'],
            'sender_name'     => $profile['display_name'] ?? $profile['username'] ?? $user['email'],
            'sender_avatar'   => $profile['avatar_url'] ?? null,
            'body'            => $data['body'],
        ]);

        $this->supabase->markConversationRead($id, $user['id']);

        return response()->json($message, 201);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $this->supabase->markConversationRead($id, $user['id']);
        return response()->json(['message' => 'Marked as read']);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user  = $request->supabaseUser;
        $count = $this->supabase->getUnreadMessageCount($user['id']);
        return response()->json(['unread_count' => $count]);
    }
}
