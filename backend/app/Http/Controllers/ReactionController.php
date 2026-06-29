<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;
use App\Services\PushService;

class ReactionController extends Controller
{
    private const VALID_TYPES = ['touched', 'magical', 'brilliant', 'beautiful', 'dreamy', 'powerful'];

    private const EMOJI_MAP = [
        'touched'   => '🌸',
        'magical'   => '💫',
        'brilliant' => '🌟',
        'beautiful' => '⭐',
        'dreamy'    => '🌙',
        'powerful'  => '☄️',
    ];

    public function __construct(
        private SupabaseService $supabase,
        private PushService     $push,
    ) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $userId = $request->supabaseUser['id'] ?? $request->query('user_identifier');
        $reactions = $this->supabase->getReactions($id, $userId);
        return response()->json($reactions);
    }

    public function toggle(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'reaction_type'   => 'required|string|in:touched,magical,brilliant,beautiful,dreamy,powerful',
            'user_identifier' => 'required|string',
        ]);

        $result = $this->supabase->toggleReaction($id, $data['user_identifier'], $data['reaction_type']);

        // ── Push: notify card owner on new reaction (logged-in users only) ─────
        if (($result['action'] ?? '') === 'added' && !str_starts_with($data['user_identifier'], 'anon_')) {
            try {
                $card = $this->supabase->getCard($id);
                if ($card && ($card['user_id'] ?? null) && $card['user_id'] !== $data['user_identifier']) {
                    $reactor     = $this->supabase->getProfile($data['user_identifier']);
                    $reactorName = $reactor['display_name'] ?? $reactor['username'] ?? 'Someone';
                    $emoji       = self::EMOJI_MAP[$data['reaction_type']] ?? '✨';
                    $this->push->sendToUser(
                        $card['user_id'],
                        "{$reactorName} {$emoji}",
                        'Reacted to your verses',
                        '/',
                        'reaction-' . $id,
                        $reactor['avatar_url'] ?? null
                    );
                }
            } catch (\Throwable) {}
        }

        return response()->json($result);
    }
}