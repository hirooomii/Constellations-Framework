<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\SupabaseService;

class CardController extends Controller
{
    public function __construct(private SupabaseService $supabase) {}

   public function index(Request $request): JsonResponse
    {
        // Try optional auth — read token if present but don't require it
        $user = null;
        $token = $request->bearerToken();

        if ($token) {
            try {
                $response = \Illuminate\Support\Facades\Http::withoutVerifying()->withHeaders([
                    'apikey'        => env('SUPABASE_SERVICE_KEY'),
                    'Authorization' => "Bearer {$token}",
                ])->get(env('SUPABASE_URL') . '/auth/v1/user');

                if ($response->successful()) {
                    $data = $response->json();
                    $user = [
                        'id'            => $data['id'],
                        'email'         => $data['email'],
                        'role'          => $data['user_metadata']['role'] ?? 'registered',
                        'user_metadata' => $data['user_metadata'] ?? [],
                    ];
                }
            } catch (\Exception $e) {
                $user = null;
            }
        }

        // Guest — top 3 only
        if (!$user) {
            $cards = $this->supabase->getTopCards(3);
            return response()->json([
                'cards'   => $cards,
                'mode'    => 'guest',
                'message' => 'Showing top 3 verses. Join to see more!',
            ]);
        }

        $role = $user['user_metadata']['role'] ?? $user['role'] ?? 'registered';

        // Admin — all cards
        if ($role === 'admin') {
            $cards = $this->supabase->getPublishedCards();
            return response()->json([
                'cards' => $cards,
                'mode'  => 'all',
            ]);
        }

        // Check follows
        $followingIds = $this->supabase->getFollowing($user['id']);

        if (empty($followingIds)) {
            $cards = $this->supabase->getPublishedCards();
            return response()->json([
                'cards'   => $cards,
                'mode'    => 'all',
                'message' => 'Follow other poets to customize your feed!',
            ]);
        }

        // Feed mode
        $cards = $this->supabase->getFollowingCards($followingIds, $user['id']);
        return response()->json([
            'cards'   => $cards,
            'mode'    => 'feed',
            'message' => 'Showing verses from poets you follow.',
        ]);
    }

    public function scheduledList(): JsonResponse
    {
        $cards = $this->supabase->getScheduledCards();
        return response()->json($cards);
    }

    public function show(string $id): JsonResponse
    {
        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);
        return response()->json($card);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->supabaseUser;
        $role = $user['user_metadata']['role'] ?? 'registered';

        if (!in_array($role, ['admin', 'registered'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'title'        => 'required|string|max:255',
            'poem'         => 'required|string',
            'description'  => 'nullable|string',
            'image_url'    => 'nullable|url',
            'display_date' => 'nullable|string',
            'scheduled_at' => 'nullable|string',
        ]);

        // Fetch profile for author info
        $profile = $this->supabase->getProfile($user['id']);

        $card = $this->supabase->insertCard([
            'title'              => $data['title'],
            'poem'               => $data['poem'],
            'description'        => $data['description'] ?? 'A verse without bounds',
            'image_url'          => $data['image_url'] ?? null,
            'display_date'       => $data['display_date'] ?? null,
            'scheduled_at'       => $data['scheduled_at'] ?? null,
            'hearts'             => 0,
            'author_id'          => $user['id'],
            'author_username'    => $profile['username'] ?? null,
            'author_display_name'=> $profile['display_name'] ?? null,
            'comments_enabled'   => true,
            'last_edited_at'     => null,
        ]);

        return response()->json($card, 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $role = $user['user_metadata']['role'] ?? 'registered';

        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        // Check ownership or admin
        if ($role !== 'admin' && $card['author_id'] !== $user['id']) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // 24 hour edit cooldown for non-admins
        if ($role !== 'admin' && !empty($card['last_edited_at'])) {
            $lastEdited = new \DateTime($card['last_edited_at']);
            $now = new \DateTime();
            $diff = $now->getTimestamp() - $lastEdited->getTimestamp();
            if ($diff < 86400) {
                $remaining = 86400 - $diff;
                $hours = floor($remaining / 3600);
                $minutes = floor(($remaining % 3600) / 60);
                return response()->json([
                    'error' => "You can edit again in {$hours}h {$minutes}m.",
                ], 429);
            }
        }

        $data = $request->validate([
            'title'            => 'sometimes|string|max:255',
            'poem'             => 'sometimes|string',
            'description'      => 'nullable|string',
            'image_url'        => 'nullable|string',
            'display_date'     => 'nullable|string',
            'scheduled_at'     => 'nullable|string',
            'comments_enabled' => 'sometimes|boolean',
        ]);

        if ($role !== 'admin') {
            $data['last_edited_at'] = now()->toIso8601String();
        }

        $updated = $this->supabase->updateCard($id, $data);
        return response()->json($updated);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $role = $user['user_metadata']['role'] ?? 'registered';

        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        if ($role !== 'admin' && $card['author_id'] !== $user['id']) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->supabase->deleteCard($id);
        return response()->json(['message' => 'Deleted']);
    }

    public function publishNow(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $role = $user['user_metadata']['role'] ?? 'registered';

        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        if ($role !== 'admin' && $card['author_id'] !== $user['id']) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = $this->supabase->updateCard($id, ['scheduled_at' => null]);
        return response()->json($updated);
    }

    public function toggleComments(Request $request, string $id): JsonResponse
    {
        $user = $request->supabaseUser;
        $role = $user['user_metadata']['role'] ?? 'registered';

        $card = $this->supabase->getCard($id);
        if (!$card) return response()->json(['error' => 'Not found'], 404);

        if ($role !== 'admin' && $card['author_id'] !== $user['id']) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $enabled = !($card['comments_enabled'] ?? true);
        $updated = $this->supabase->updateCard($id, ['comments_enabled' => $enabled]);
        return response()->json($updated);
    }
}