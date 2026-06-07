<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SupabaseAuth
{
    public function handle(Request $request, Closure $next, string $require = 'any')
    {
        $token = $this->extractToken($request);

        if (!$token) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $user = $this->verifyToken($token);

        if (!$user) {
            return response()->json(['error' => 'Invalid or expired token'], 401);
        }

        $request->merge(['supabaseUser' => $user]);

        return $next($request);
    }

    private function extractToken(Request $request): ?string
    {
        $header = $request->header('Authorization', '');
        if (str_starts_with($header, 'Bearer ')) {
            return substr($header, 7);
        }
        return null;
    }

    private function verifyToken(string $token): ?array
    {
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'apikey'        => env('SUPABASE_SERVICE_KEY'),
                'Authorization' => "Bearer {$token}",
            ])->get(env('SUPABASE_URL') . '/auth/v1/user');

            if ($response->successful()) {
                $data = $response->json();
                return [
                    'id'            => $data['id'],
                    'email'         => $data['email'],
                    'role'          => $data['user_metadata']['role'] ?? 'registered',
                    'user_metadata' => $data['user_metadata'] ?? [],
                ];
            }
        } catch (\Exception $e) {
            \Log::error('Supabase token verification failed: ' . $e->getMessage());
        }

        return null;
    }
}