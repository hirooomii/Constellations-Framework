<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class ProfileController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

    public function show(string $username): JsonResponse
    {
        $profile = $this->supabase->getProfileByUsername($username);
        if (!$profile) return response()->json(['error' => 'Profile not found'], 404);

        $cards = $this->supabase->getUserCards($profile['id']);

        return response()->json([
            'profile' => $profile,
            'cards'   => $cards,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;

        $data = $request->validate([
            'display_name'   => 'sometimes|string|min:1|max:50',
            'bio'            => 'nullable|string|max:200',
            'avatar_url'     => 'nullable|string',
            'birthday'       => 'nullable|date',
            'zodiac_sign'    => 'nullable|string',
            'birthday_public'=> 'sometimes|boolean',
        ]);

        $profile = $this->supabase->updateProfile($user['id'], $data);
        return response()->json($profile);
    }
}