<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class PushController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

    public function subscribe(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate([
            'endpoint' => 'required|string',
            'p256dh'   => 'required|string',
            'auth'     => 'required|string',
        ]);

        $this->supabase->savePushSubscription($user['id'], $data['endpoint'], $data['p256dh'], $data['auth']);

        return response()->json(['message' => 'Subscribed']);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $data = $request->validate(['endpoint' => 'required|string']);

        $this->supabase->deleteUserPushSubscription($user['id'], $data['endpoint']);

        return response()->json(['message' => 'Unsubscribed']);
    }
}
