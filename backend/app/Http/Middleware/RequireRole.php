<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireRole
{
    /**
     * Usage: ->middleware('role:admin')
     *        ->middleware('role:admin,registered')
     */
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->supabaseUser ?? null;

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        if (!in_array($user['role'], $roles)) {
            return response()->json([
                'error' => 'Forbidden. Required role: ' . implode(' or ', $roles),
            ], 403);
        }

        return $next($request);
    }
}
