<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\SupabaseService;

class NotificationController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

    public function index(Request $request)
    {
        $currentUser = $request->supabaseUser;
        if (!$currentUser) return response()->json(['error' => 'Unauthorized'], 401);

        $userId = $currentUser['id'];
        $notifications = $this->supabase->getNotifications($userId, 10, 0);
        $unreadCount = count(array_filter($notifications, fn($n) => !$n['is_read']));

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => $unreadCount,
        ]);
    }

    public function archive(Request $request)
    {
        $currentUser = $request->supabaseUser;
        if (!$currentUser) return response()->json(['error' => 'Unauthorized'], 401);

        $notifications = $this->supabase->getNotifications($currentUser['id'], 50, 10);

        return response()->json(['notifications' => $notifications]);
    }

    public function readAll(Request $request)
    {
        $currentUser = $request->supabaseUser;
        if (!$currentUser) return response()->json(['error' => 'Unauthorized'], 401);

        $this->supabase->markAllNotificationsRead($currentUser['id']);

        return response()->json(['success' => true]);
    }

    public function readOne(Request $request, string $id)
    {
        $currentUser = $request->supabaseUser;
        if (!$currentUser) return response()->json(['error' => 'Unauthorized'], 401);

        $this->supabase->markNotificationRead($id, $currentUser['id']);

        return response()->json(['success' => true]);
    }
}