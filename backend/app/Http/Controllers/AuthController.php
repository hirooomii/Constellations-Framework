<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use App\Services\SupabaseService;

class AuthController extends Controller
{
    private string $supabaseUrl;
    private string $serviceKey;
    private SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabaseUrl = env('SUPABASE_URL');
        $this->serviceKey  = env('SUPABASE_SERVICE_KEY');
        $this->supabase    = $supabase;
    }

    private function http()
    {
        return Http::withoutVerifying()->withHeaders([
            'apikey'       => $this->serviceKey,
            'Content-Type' => 'application/json',
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'        => 'required|email',
            'password'     => 'required|min:8',
            'username'     => 'required|string|min:3|max:30|alpha_dash',
            'display_name' => 'required|string|min:1|max:50',
        ]);

        // Check username taken
        $existing = $this->supabase->getProfileByUsername($data['username']);
        if ($existing) {
            return response()->json(['error' => 'Username already taken.'], 422);
        }

        // Sign up via Supabase Auth — pass redirect_to so confirmation email links back to the app
        $redirectTo = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/');
        $res = $this->http()->post("{$this->supabaseUrl}/auth/v1/signup?redirect_to=" . urlencode($redirectTo), [
            'email'    => $data['email'],
            'password' => $data['password'],
            'data'     => [
                'role'         => 'registered',
                'username'     => $data['username'],
                'display_name' => $data['display_name'],
            ],
        ]);

        if (!$res->successful()) {
            $body = $res->json();
            return response()->json([
                'error' => $body['msg'] ?? $body['error_description'] ?? 'Registration failed',
            ], $res->status());
        }

        $user = $res->json();
        $userId = $user['id'] ?? null;

        // Create profile record
        if ($userId) {
            try {
                $this->supabase->insertProfile([
                    'id'           => $userId,
                    'username'     => $data['username'],
                    'display_name' => $data['display_name'],
                    'avatar_url'   => null,
                    'bio'          => null,
                ]);
            } catch (\Exception $e) {
                // Profile creation failed but user was created
            }
        }

        return response()->json([
            'message' => 'Registration successful. Please check your email to confirm your account.',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $res = $this->http()->post("{$this->supabaseUrl}/auth/v1/token?grant_type=password", [
            'email'    => $data['email'],
            'password' => $data['password'],
        ]);

        if (!$res->successful()) {
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        $session = $res->json();

        $userRes = Http::withoutVerifying()->withHeaders([
            'apikey'        => $this->serviceKey,
            'Authorization' => "Bearer {$session['access_token']}",
        ])->get("{$this->supabaseUrl}/auth/v1/user");

        $user = $userRes->json();
        $role = $user['user_metadata']['role'] ?? 'registered';

        // Fetch profile
       $profile = $this->supabase->getProfile($user['id']);

        return response()->json([
            'access_token'  => $session['access_token'],
            'refresh_token' => $session['refresh_token'],
            'expires_in'    => $session['expires_in'],
            'user' => [
                'id'             => $user['id'],
                'email'          => $user['email'],
                'role'           => $role,
                'username'       => $profile['username'] ?? null,
                'display_name'   => $profile['display_name'] ?? null,
                'avatar_url'     => $profile['avatar_url'] ?? null,
                'bio'            => $profile['bio'] ?? null,
                'birthday'       => $profile['birthday'] ?? null,        // ← add
                'zodiac_sign'    => $profile['zodiac_sign'] ?? null,     // ← add
                'birthday_public'=> $profile['birthday_public'] ?? true, // ← add
            ],
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => 'required|string',
        ]);

        $res = $this->http()->post("{$this->supabaseUrl}/auth/v1/token?grant_type=refresh_token", [
            'refresh_token' => $data['refresh_token'],
        ]);

        if (!$res->successful()) {
            return response()->json(['error' => 'Failed to refresh token'], 401);
        }

        return response()->json($res->json());
    }

   public function me(Request $request): JsonResponse
    {
        $supabaseUser = $request->supabaseUser;
        $profile      = $this->supabase->getProfile($supabaseUser['id']);

        // First-time OAuth login — auto-create a profile
        if (!$profile) {
            $meta        = $supabaseUser['user_metadata'] ?? [];
            $displayName = $meta['full_name'] ?? $meta['name']
                        ?? (!empty($supabaseUser['email']) ? explode('@', $supabaseUser['email'])[0] : 'User');
            $avatarUrl   = $meta['avatar_url'] ?? null;

            // Build a clean username from provider handle, email, or display name
            $raw = $meta['user_name'] ?? $meta['preferred_username'] ?? null;

            if (!$raw) {
                if (!empty($supabaseUser['email'])) {
                    $raw = strtolower(explode('@', $supabaseUser['email'])[0]);
                } elseif (!empty($displayName)) {
                    $raw = strtolower($displayName);
                } else {
                    $raw = 'user';
                }
            }

            $raw  = preg_replace('/[^a-z0-9]/', '_', strtolower($raw));
            $base = substr(preg_replace('/_+/', '_', trim($raw, '_')), 0, 20);

            // Guard against an empty/blank result after sanitizing
            if ($base === '' || $base === '_') {
                $base = 'user_' . substr($supabaseUser['id'], 0, 8);
            }

            $username = $base;
            $attempt  = 1;
            while ($this->supabase->getProfileByUsername($username)) {
                $username = $base . '_' . $attempt++;
            }

            try {
                $this->supabase->insertProfile([
                    'id'           => $supabaseUser['id'],
                    'username'     => $username,
                    'display_name' => $displayName,
                    'avatar_url'   => $avatarUrl,
                    'bio'          => null,
                ]);
                $profile = $this->supabase->getProfile($supabaseUser['id']);
            } catch (\Exception $e) {
                \Log::error('OAuth profile creation failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'access_token'  => $request->bearerToken(),
            'refresh_token' => '',
            'expires_in'    => 3600,
            'user' => [
                'id'             => $supabaseUser['id'],
                'email'          => $supabaseUser['email'],
                'role'           => $profile['role']           ?? $supabaseUser['role'] ?? 'registered',
                'username'       => $profile['username']       ?? null,
                'display_name'   => $profile['display_name']   ?? null,
                'avatar_url'     => $profile['avatar_url']     ?? null,
                'bio'            => $profile['bio']             ?? null,
                'birthday'       => $profile['birthday']        ?? null,
                'zodiac_sign'    => $profile['zodiac_sign']      ?? null,
                'birthday_public'=> $profile['birthday_public']  ?? true,
            ],
        ]);
    }

    public function setAdmin(Request $request): JsonResponse
    {
        if ($request->header('X-Admin-Setup-Key') !== env('ADMIN_SETUP_KEY')) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|string',
        ]);

        $res = Http::withoutVerifying()->withHeaders([
            'apikey'        => $this->serviceKey,
            'Authorization' => "Bearer {$this->serviceKey}",
            'Content-Type'  => 'application/json',
        ])->put("{$this->supabaseUrl}/auth/v1/admin/users/{$data['user_id']}", [
            'user_metadata' => ['role' => 'admin'],
        ]);

        if (!$res->successful()) {
            return response()->json(['error' => 'Failed to set admin role'], 500);
        }

        return response()->json(['message' => 'User promoted to admin']);
    }
}