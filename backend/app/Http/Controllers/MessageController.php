<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;
use App\Services\PushService;

class MessageController extends Controller
{
    public function __construct(
        private SupabaseService $supabase,
        private PushService     $push,
    ) {}

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

    public function createGroup(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate([
            'name'         => 'required|string|max:80',
            'member_ids'   => 'required|array|min:1',
            'member_ids.*' => 'string',
        ]);

        $memberIds = array_filter($data['member_ids'], fn($id) => $id !== $user['id']);

        $result = $this->supabase->createGroupConversation($data['name'], $user['id'], array_values($memberIds));
        return response()->json($result, 201);
    }

    public function addMember(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate(['user_id' => 'required|string']);

        $participating = $this->supabase->getUserConversationIds($user['id']);
        if (!in_array($id, $participating)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $this->supabase->addConversationMember($id, $data['user_id']);
        return response()->json(['message' => 'Member added']);
    }

    public function removeMember(Request $request, string $id, string $userId): JsonResponse
    {
        $user = $request->supabaseUser;

        $participating = $this->supabase->getUserConversationIds($user['id']);
        if (!in_array($id, $participating)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($userId !== $user['id']) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->supabase->removeConversationMember($id, $userId);
        return response()->json(['message' => 'Removed from group']);
    }

    public function messages(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $participations = $this->supabase->getUserConversationIds($user['id']);
        if (!in_array($id, $participations)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $msgs = $this->supabase->getMessages($id, $user['id']);
        return response()->json(['messages' => $msgs]);
    }

    public function send(Request $request, string $id): JsonResponse
    {
        $user    = $request->supabaseUser;
        $data    = $request->validate([
            'body'      => 'required|string|max:1000',
            'parent_id' => 'nullable|string',
        ]);
        $profile = $this->supabase->getProfile($user['id']);

        $replyToName  = null;
        $replyPreview = null;
        if (!empty($data['parent_id'])) {
            $parent       = $this->supabase->getMessageById($data['parent_id']);
            $replyToName  = $parent['sender_name'] ?? null;
            $replyPreview = $parent ? mb_substr($parent['body'], 0, 100) : null;
        }

        $message = $this->supabase->insertMessage([
            'conversation_id' => $id,
            'sender_id'       => $user['id'],
            'sender_name'     => $profile['display_name'] ?? $profile['username'] ?? $user['email'],
            'sender_avatar'   => $profile['avatar_url'] ?? null,
            'body'            => $data['body'],
            'parent_id'       => $data['parent_id'] ?? null,
            'reply_to_name'   => $replyToName,
            'reply_preview'   => $replyPreview,
        ]);

        $this->supabase->markConversationRead($id, $user['id']);

        // ── Push notification to other participants ───────────────────────────
        try {
            $conv        = $this->supabase->getConversationMeta($id);
            $convType    = $conv['type']  ?? 'direct';
            $convName    = $conv['name']  ?? null;
            $senderName  = $profile['display_name'] ?? $profile['username'] ?? 'Someone';
            $notifTitle  = $convType === 'group' ? ($convName ?? 'Group Chat') : $senderName;
            $notifBody   = mb_substr($data['body'], 0, 120);
            $participants = $this->supabase->getConversationParticipants($id);

            foreach ($participants as $pid) {
                if ($pid === $user['id']) continue;
                $this->push->sendToUser($pid, $notifTitle, $notifBody, '/?messages=open', 'msg-' . $id);
            }
        } catch (\Throwable) {
            // Never fail the send because of push errors
        }

        return response()->json($message, 201);
    }

    public function toggleReaction(Request $request, string $messageId): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate(['emoji' => 'required|string|max:10']);

        $result = $this->supabase->toggleMessageReaction($messageId, $user['id'], $data['emoji']);
        return response()->json($result);
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
