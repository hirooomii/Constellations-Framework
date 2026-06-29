<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CardController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\FollowController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PushController;

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
        ->get("https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily", [
            'sign' => $sign,
            'day'  => 'TODAY',
        ]);

    if (!$res->successful()) {
        return response()->json(['error' => 'Failed to fetch horoscope'], 500);
    }

    $data = $res->json();

    // Try both possible response keys
    $horoscope = $data['data']['horoscope_data'] 
              ?? $data['data']['horoscope'] 
              ?? '';

    return response()->json([
        'data' => [
            'horoscope' => $horoscope,
            'sign'      => $sign,
            'date'      => now()->toDateString(),
        ]
    ]);
});

// ── FOLLOWS ───────────────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::post('/follow/{username}',    [FollowController::class, 'toggle']);
    Route::get('/follow/{username}',     [FollowController::class, 'status']);
    Route::get('/following',             [FollowController::class, 'following']);
    Route::get('/users/suggested', [FollowController::class, 'suggested']);
    Route::get('/users/search', [FollowController::class, 'search']);
});

Route::get('/profiles/{username}/followers', [FollowController::class, 'followers']);
Route::get('/profiles/{username}/following', [FollowController::class, 'followingList']);

// ── MESSAGES ───────────────────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::get('/conversations',                             [MessageController::class, 'index']);
    Route::post('/conversations/open',                       [MessageController::class, 'open']);
    Route::post('/conversations/group',                      [MessageController::class, 'createGroup']);
    Route::get('/conversations/unread',                      [MessageController::class, 'unreadCount']);
    Route::get('/conversations/{id}/messages',               [MessageController::class, 'messages']);
    Route::post('/conversations/{id}/messages',              [MessageController::class, 'send']);
    Route::patch('/conversations/{id}/read',                 [MessageController::class, 'markRead']);
    Route::post('/conversations/{id}/members',               [MessageController::class, 'addMember']);
    Route::delete('/conversations/{id}/members/{userId}',    [MessageController::class, 'removeMember']);
    Route::post('/messages/{messageId}/reactions',           [MessageController::class, 'toggleReaction']);
});

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/archive', [NotificationController::class, 'archive']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'readOne']);
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
Route::middleware('auth.supabase')->group(function () {
    Route::post('/push/subscribe',   [PushController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushController::class, 'unsubscribe']);
});