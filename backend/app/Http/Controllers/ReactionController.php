<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class ReactionController extends Controller
{
    private const VALID_TYPES = ['touched', 'magical', 'brilliant', 'beautiful', 'dreamy', 'powerful'];

    public function __construct(private SupabaseService $supabase) {}

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
        return response()->json($result);
    }
}