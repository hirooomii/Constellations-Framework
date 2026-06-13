<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CardController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\FollowController;

// ── AUTH ─────────────────────────────────────────────────────────────────────
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login',    [AuthController::class, 'login']);
Route::post('/auth/refresh',  [AuthController::class, 'refresh']);
Route::post('/auth/set-admin',[AuthController::class, 'setAdmin']);
Route::get('/auth/me',        [AuthController::class, 'me'])->middleware('auth.supabase');

// ── PROFILES ──────────────────────────────────────────────────────────────────
Route::get('/profiles/{username}',        [ProfileController::class, 'show']);
Route::patch('/profiles',                 [ProfileController::class, 'update'])->middleware('auth.supabase');
Route::post('/profiles/avatar',           [ProfileController::class, 'updateAvatar'])->middleware('auth.supabase');

// ── CARDS (public) ────────────────────────────────────────────────────────────
Route::get('/cards',          [CardController::class, 'index']);
Route::get('/cards/{id}',     [CardController::class, 'show']);

// ── CARDS (authenticated) ─────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::post('/cards',                        [CardController::class, 'store']);
    Route::patch('/cards/{id}',                  [CardController::class, 'update']);
    Route::delete('/cards/{id}',                 [CardController::class, 'destroy']);
    Route::patch('/cards/{id}/publish-now',      [CardController::class, 'publishNow']);
    Route::patch('/cards/{id}/toggle-comments',  [CardController::class, 'toggleComments']);
});

// ── ADMIN ONLY ────────────────────────────────────────────────────────────────
Route::middleware(['auth.supabase', 'role:admin'])->group(function () {
    Route::get('/admin/cards/scheduled',         [CardController::class, 'scheduledList']);
    Route::delete('/admin/comments/{id}',        [CommentController::class, 'destroy']);
});

// ── REACTIONS ─────────────────────────────────────────────────────────────────
Route::get('/cards/{id}/reactions',  [ReactionController::class, 'index']);
Route::post('/cards/{id}/reactions', [ReactionController::class, 'toggle']);

// ── COMMENTS ──────────────────────────────────────────────────────────────────
Route::get('/cards/{id}/comments',   [CommentController::class, 'index']);
Route::post('/cards/{id}/comments',  [CommentController::class, 'store'])->middleware('auth.supabase');

// ── ZODIAC ──────────────────────────────────────────────────────────────────
Route::get('/horoscope/{sign}', function (string $sign) {
    $res = \Illuminate\Support\Facades\Http::withoutVerifying()
        ->get("https://freehoroscopeapi.com/api/v1/get-horoscope/daily?sign={$sign}");
    
    if (!$res->successful()) {
        return response()->json(['error' => 'Failed to fetch horoscope'], 500);
    }
    return response()->json($res->json());
});

// ── FOLLOWS ───────────────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::post('/follow/{username}',    [FollowController::class, 'toggle']);
    Route::get('/follow/{username}',     [FollowController::class, 'status']);
    Route::get('/following',             [FollowController::class, 'following']);
    Route::get('/users/suggested', [FollowController::class, 'suggested']);
    Route::get('/users/search', [FollowController::class, 'search']);
});