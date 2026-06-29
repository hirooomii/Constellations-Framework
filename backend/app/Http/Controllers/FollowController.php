<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;
use App\Services\PushService;

class FollowController extends Controller
{
    public function __construct(
        private SupabaseService $supabase,
        private PushService     $push,
    ) {}

    public function toggle(Request $request, string $username): JsonResponse
    {
        $currentUser = $request->supabaseUser;

        $profile = $this->supabase->getProfileByUsername($username);
        if (!$profile) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $followingId = $profile['id'];
        $followerId  = $currentUser['id'];

        if ($followerId === $followingId) {
            return response()->json(['error' => 'Cannot follow yourself'], 422);
        }

        $isFollowing = $this->supabase->isFollowing($followerId, $followingId);

        if ($isFollowing) {
            $this->supabase->unfollowUser($followerId, $followingId);
            return response()->json([
                'action'    => 'unfollowed',
                'username'  => $username,
            ]);
        } else {
            $this->supabase->followUser($followerId, $followingId);

            try {
                $followerProfile = $this->supabase->getProfile($followerId);
                $followerName    = $followerProfile['display_name'] ?? $followerProfile['username'] ?? 'Someone';
                $this->push->sendToUser(
                    $followingId,
                    "{$followerName} 👥",
                    'Started following you',
                    "/?profile={$username}",
                    'follow-' . $followerId
                );
            } catch (\Throwable) {}

            return response()->json([
                'action'    => 'followed',
                'username'  => $username,
            ]);
        }
    }

    public function status(Request $request, string $username): JsonResponse
    {
        $currentUser = $request->supabaseUser;

        $profile = $this->supabase->getProfileByUsername($username);
        if (!$profile) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $isFollowing = $this->supabase->isFollowing($currentUser['id'], $profile['id']);

        return response()->json([
            'is_following'    => $isFollowing,
            'followers_count' => $profile['followers_count'] ?? 0,
            'following_count' => $profile['following_count'] ?? 0,
        ]);
    }

    public function following(Request $request): JsonResponse
    {
        $currentUser = $request->supabaseUser;
        $followingIds = $this->supabase->getFollowing($currentUser['id']);
        return response()->json(['following' => $followingIds]);
    }

    public function suggested(Request $request): JsonResponse
    {
        $currentUser = $request->supabaseUser;
        $users = $this->supabase->getSuggestedUsers($currentUser['id'], 5);
        return response()->json(['users' => $users]);
    }

    public function search(Request $request): JsonResponse
    {
        $currentUser = $request->supabaseUser;
        $query = $request->query('q', '');
        if (strlen($query) < 1) {
            return response()->json(['users' => []]);
        }
        $users = $this->supabase->searchUsers($query, $currentUser['id'], 10);
        return response()->json(['users' => $users]);
    }

    public function followers(Request $request, string $username): JsonResponse
    {
        $profile = $this->supabase->getProfileByUsername($username);
        if (!$profile) return response()->json(['error' => 'Not found'], 404);

        $followerIds = $this->supabase->getFollowers($profile['id']);
        $users = array_filter(array_map(fn($id) => $this->supabase->getProfile($id), $followerIds));
        $users = array_values(array_map(fn($u) => [
            'id' => $u['id'], 'username' => $u['username'],
            'display_name' => $u['display_name'], 'avatar_url' => $u['avatar_url'] ?? null,
        ], $users));

        return response()->json(['users' => $users]);
    }

    public function followingList(Request $request, string $username): JsonResponse
    {
        $profile = $this->supabase->getProfileByUsername($username);
        if (!$profile) return response()->json(['error' => 'Not found'], 404);

        $followingIds = $this->supabase->getFollowing($profile['id']);
        $users = array_filter(array_map(fn($id) => $this->supabase->getProfile($id), $followingIds));
        $users = array_values(array_map(fn($u) => [
            'id' => $u['id'], 'username' => $u['username'],
            'display_name' => $u['display_name'], 'avatar_url' => $u['avatar_url'] ?? null,
        ], $users));

        return response()->json(['users' => $users]);
    }
    
}