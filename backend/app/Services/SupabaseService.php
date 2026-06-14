<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class SupabaseService
{
    private string $url;
    private string $key;

    public function __construct()
    {
        $this->url = env('SUPABASE_URL');
        $this->key = env('SUPABASE_SERVICE_KEY');
    }

    private function http()
    {
        return Http::withoutVerifying()->withHeaders($this->headers());
    }

    private function httpWith(array $extra = [])
    {
        return Http::withoutVerifying()->withHeaders($this->headers($extra));
    }

    private function headers(array $extra = []): array
    {
        return array_merge([
            'apikey'        => $this->key,
            'Authorization' => "Bearer {$this->key}",
            'Content-Type'  => 'application/json',
        ], $extra);
    }

    // ── PROFILES ─────────────────────────────────────────────────────────────

    public function getProfile(string $userId): ?array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/profiles", [
            'id'     => "eq.{$userId}",
            'select' => '*',
            'limit'  => 1,
        ]);
        $data = $res->json();
        return (!empty($data) && is_array($data)) ? $data[0] : null;
    }

    public function getProfileByUsername(string $username): ?array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/profiles", [
            'username' => "eq.{$username}",
            'select'   => '*',
            'limit'    => 1,
        ]);
        $data = $res->json();
        return (!empty($data) && is_array($data)) ? $data[0] : null;
    }

    public function insertProfile(array $data): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->post("{$this->url}/rest/v1/profiles", $data);
        if (!$res->successful()) throw new \RuntimeException($res->body());
        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function updateProfile(string $userId, array $data): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->patch("{$this->url}/rest/v1/profiles?id=eq.{$userId}", $data);
        if (!$res->successful()) throw new \RuntimeException($res->body());
        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function getUserCards(string $userId): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'author_id' => "eq.{$userId}",
            'select'    => '*',
            'order'     => 'created_at.desc',
        ]);
        $cards = $res->successful() ? $res->json() : [];
        $cards = array_map([$this, 'enrichCardWithAvatar'], $cards);

        return array_map(function (array $card) {
            $res = $this->http()->get("{$this->url}/rest/v1/reactions", [
                'card_id' => "eq.{$card['id']}",
                'select'  => 'reaction_type',
            ]);
            $rows = $res->successful() ? $res->json() : [];
            $counts = [];
            foreach ($rows as $row) {
                $type = $row['reaction_type'];
                $counts[$type] = ($counts[$type] ?? 0) + 1;
            }
            $card['reaction_counts'] = $counts;
            $card['reaction_count']  = array_sum($counts);
            return $card;
        }, $cards);
    }

    // ── FOLLOWS ───────────────────────────────────────────────────────────────

    public function followUser(string $followerId, string $followingId): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->post("{$this->url}/rest/v1/follows", [
                'follower_id'  => $followerId,
                'following_id' => $followingId,
            ]);
        if (!$res->successful()) throw new \RuntimeException($res->body());

        $this->incrementFollowCounts($followerId, $followingId);

        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function unfollowUser(string $followerId, string $followingId): void
    {
        $res = $this->http()
            ->delete("{$this->url}/rest/v1/follows?follower_id=eq.{$followerId}&following_id=eq.{$followingId}");
        if (!$res->successful()) throw new \RuntimeException($res->body());

        $this->decrementFollowCounts($followerId, $followingId);
    }

    public function isFollowing(string $followerId, string $followingId): bool
    {
        $res = $this->http()->get("{$this->url}/rest/v1/follows", [
            'follower_id'  => "eq.{$followerId}",
            'following_id' => "eq.{$followingId}",
            'select'       => 'id',
            'limit'        => 1,
        ]);
        $data = $res->json();
        return !empty($data);
    }

    public function getFollowing(string $userId): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/follows", [
            'follower_id' => "eq.{$userId}",
            'select'      => 'following_id',
        ]);
        if (!$res->successful()) return [];
        return array_column($res->json(), 'following_id');
    }

    public function getFollowers(string $userId): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/follows", [
            'following_id' => "eq.{$userId}",
            'select'       => 'follower_id',
        ]);
        if (!$res->successful()) return [];
        return array_column($res->json(), 'follower_id');
    }

    private function incrementFollowCounts(string $followerId, string $followingId): void
    {
        $follower = $this->getProfile($followerId);
        if ($follower) {
            $this->http()->patch("{$this->url}/rest/v1/profiles?id=eq.{$followerId}", [
                'following_count' => ($follower['following_count'] ?? 0) + 1,
            ]);
        }
        $following = $this->getProfile($followingId);
        if ($following) {
            $this->http()->patch("{$this->url}/rest/v1/profiles?id=eq.{$followingId}", [
                'followers_count' => ($following['followers_count'] ?? 0) + 1,
            ]);
        }
    }

    private function decrementFollowCounts(string $followerId, string $followingId): void
    {
        $follower = $this->getProfile($followerId);
        if ($follower) {
            $this->http()->patch("{$this->url}/rest/v1/profiles?id=eq.{$followerId}", [
                'following_count' => max(0, ($follower['following_count'] ?? 0) - 1),
            ]);
        }
        $following = $this->getProfile($followingId);
        if ($following) {
            $this->http()->patch("{$this->url}/rest/v1/profiles?id=eq.{$followingId}", [
                'followers_count' => max(0, ($following['followers_count'] ?? 0) - 1),
            ]);
        }
    }

    public function getSuggestedUsers(string $userId, int $limit = 5): array
    {
        $followingIds = $this->getFollowing($userId);
        $excludeIds   = array_merge($followingIds, [$userId]);
        $excludeList  = implode(',', array_map(fn($id) => "\"{$id}\"", $excludeIds));

        $res = $this->http()->get("{$this->url}/rest/v1/profiles", [
            'select' => 'id,username,display_name,avatar_url,bio,followers_count',
            'order'  => 'followers_count.desc',
            'limit'  => $limit + count($excludeIds),
        ]);

        $users = $res->successful() ? $res->json() : [];

        $users = array_values(array_filter($users, fn($u) => !in_array($u['id'], $excludeIds)));

        return array_slice($users, 0, $limit);
    }

    public function searchUsers(string $query, string $userId, int $limit = 10): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/profiles", [
            'select'       => 'id,username,display_name,avatar_url,bio,followers_count',
            'or'           => "(username.ilike.*{$query}*,display_name.ilike.*{$query}*)",
            'limit'        => $limit,
        ]);

        $users = $res->successful() ? $res->json() : [];
        
        return array_values(array_filter($users, fn($u) => $u['id'] !== $userId));
    }

    // ── CARDS ────────────────────────────────────────────────────────────────

    public function getTopCards(int $limit = 3): array
    {
        $now = now()->toIso8601String();
        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'select' => '*',
            'or'     => "(scheduled_at.is.null,scheduled_at.lte.{$now})",
        ]);
        $cards = $res->successful() ? $res->json() : [];
        $cards = array_map([$this, 'enrichCardWithAvatar'], $cards);
        $cards = array_map([$this, 'enrichCardWithReactions'], $cards);

        // Enrich with comment count
        $cards = array_map(function (array $card) {
            $res = $this->http()->get("{$this->url}/rest/v1/comments", [
                'card_id' => "eq.{$card['id']}",
                'select'  => 'id',
            ]);
            $card['comment_count'] = $res->successful() ? count($res->json()) : 0;
            return $card;
        }, $cards);

        // Sort by reaction_count + comment_count descending
        usort($cards, function ($a, $b) {
            $scoreA = ($a['reaction_count'] ?? 0) + ($a['comment_count'] ?? 0);
            $scoreB = ($b['reaction_count'] ?? 0) + ($b['comment_count'] ?? 0);
            return $scoreB <=> $scoreA;
        });

        return array_slice($cards, 0, $limit);
    }

    public function getPublishedCards(): array
    {
        $now = now()->toIso8601String();
        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'select' => '*',
            'order'  => 'created_at.desc',
            'or'     => "(scheduled_at.is.null,scheduled_at.lte.{$now})",
        ]);
        $cards = $res->successful() ? $res->json() : [];
        $cards = array_map([$this, 'enrichCardWithAvatar'], $cards);
        return array_map([$this, 'enrichCardWithReactions'], $cards);
    }

    public function getFollowingCards(array $followingIds, string $userId): array
    {
        if (empty($followingIds)) return [];

        $allIds  = array_unique(array_merge($followingIds, [$userId]));
        $idList  = implode(',', $allIds);
        $now     = now()->toIso8601String();

        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'select'    => '*',
            'order'     => 'created_at.desc',
            'author_id' => "in.({$idList})",
            'or'        => "(scheduled_at.is.null,scheduled_at.lte.{$now})",
        ]);
        $cards = $res->successful() ? $res->json() : [];
        $cards = array_map([$this, 'enrichCardWithAvatar'], $cards);
        return array_map([$this, 'enrichCardWithReactions'], $cards);
    }

    public function getScheduledCards(): array
    {
        $now = now()->toIso8601String();
        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'select'       => '*',
            'scheduled_at' => "gt.{$now}",
            'order'        => 'scheduled_at.asc',
        ]);
        $cards = $res->successful() ? $res->json() : [];
        return array_map([$this, 'enrichCardWithAvatar'], $cards);
    }

    public function getCard(string $id): ?array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/cards", [
            'id'     => "eq.{$id}",
            'select' => '*',
            'limit'  => 1,
        ]);
        $data = $res->json();
        if (empty($data) || !is_array($data) || !isset($data[0])) return null;
        return $this->enrichCardWithAvatar($data[0]);
    }

    private function enrichCardWithAvatar(array $card): array
    {
        $authorId = $card['author_id'] ?? null;
        unset($card['profiles']);

        if (!$authorId) {
            $card['author_avatar_url'] = null;
            return $card;
        }

        try {
            $profile = $this->getProfile($authorId);
            $card['author_avatar_url'] = $profile['avatar_url'] ?? null;
        } catch (\Throwable $e) {
            $card['author_avatar_url'] = null;
        }

        return $card;
    }

    private function enrichCardWithReactions(array $card): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/reactions", [
            'card_id' => "eq.{$card['id']}",
            'select'  => 'reaction_type',
        ]);
        $rows   = $res->successful() ? $res->json() : [];
        $counts = [];
        foreach ($rows as $row) {
            $type           = $row['reaction_type'];
            $counts[$type]  = ($counts[$type] ?? 0) + 1;
        }
        $card['reaction_counts'] = $counts;
        $card['reaction_count']  = array_sum($counts);
        return $card;
    }

    public function insertCard(array $data): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->post("{$this->url}/rest/v1/cards", $data);
        if (!$res->successful()) throw new \RuntimeException($res->body());
        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function updateCard(string $id, array $data): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->patch("{$this->url}/rest/v1/cards?id=eq.{$id}", $data);
        if (!$res->successful()) throw new \RuntimeException($res->body());
        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function deleteCard(string $id): void
    {
        $res = $this->http()->delete("{$this->url}/rest/v1/cards?id=eq.{$id}");
        if (!$res->successful()) throw new \RuntimeException($res->body());
    }

    public function toggleCommentsEnabled(string $id, bool $enabled): array
    {
        return $this->updateCard($id, ['comments_enabled' => $enabled]);
    }

    // ── REACTIONS ────────────────────────────────────────────────────────────

    public function getReactions(string $cardId, ?string $userId): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/reactions", [
            'card_id' => "eq.{$cardId}",
            'select'  => '*',
        ]);

        $all        = $res->successful() ? $res->json() : [];
        $counts     = [];
        $myReactions = [];

        foreach ($all as $r) {
            $type           = $r['reaction_type'] ?? 'touched';
            $counts[$type]  = ($counts[$type] ?? 0) + 1;
            if ($userId && $r['user_identifier'] === $userId) {
                $myReactions[] = $type;
            }
        }

        return ['counts' => $counts, 'mine' => $myReactions];
    }

    public function toggleReaction(string $cardId, string $userIdentifier, string $reactionType = 'touched'): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/reactions", [
            'card_id'         => "eq.{$cardId}",
            'user_identifier' => "eq.{$userIdentifier}",
            'reaction_type'   => "eq.{$reactionType}",
            'select'          => 'id',
        ]);

        $existing = $res->json();

        if (!empty($existing)) {
            Http::withoutVerifying()->withHeaders($this->headers())
                ->delete("{$this->url}/rest/v1/reactions?card_id=eq.{$cardId}&user_identifier=eq.{$userIdentifier}&reaction_type=eq.{$reactionType}");
            return ['action' => 'removed', 'reaction_type' => $reactionType];
        } else {
            Http::withoutVerifying()->withHeaders($this->headers(['Prefer' => 'return=minimal']))
                ->post("{$this->url}/rest/v1/reactions", [
                    'card_id'         => $cardId,
                    'user_identifier' => $userIdentifier,
                    'reaction_type'   => $reactionType,
                ]);
            return ['action' => 'added', 'reaction_type' => $reactionType];
        }
    }

    // ── COMMENTS ─────────────────────────────────────────────────────────────

    public function getComments(string $cardId): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/comments", [
            'card_id' => "eq.{$cardId}",
            'order'   => 'created_at.asc',
            'select'  => '*',
        ]);
        $comments = $res->successful() ? $res->json() : [];

        return array_map(function (array $comment) {
            $userId = $comment['user_id'] ?? null;
            if ($userId) {
                try {
                    $profile               = $this->getProfile($userId);
                    $comment['avatar_url'] = $profile['avatar_url'] ?? null;
                } catch (\Throwable $e) {
                    $comment['avatar_url'] = null;
                }
            }
            return $comment;
        }, $comments);
    }

    public function insertComment(array $data): array
    {
        $res = $this->httpWith(['Prefer' => 'return=representation'])
            ->post("{$this->url}/rest/v1/comments", $data);
        if (!$res->successful()) throw new \RuntimeException($res->body());
        $json = $res->json();
        return is_array($json) && isset($json[0]) ? $json[0] : $json;
    }

    public function deleteComment(string $id): void
    {
        $res = $this->http()->delete("{$this->url}/rest/v1/comments?id=eq.{$id}");
        if (!$res->successful()) throw new \RuntimeException($res->body());
    }

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

    public function getNotifications(string $userId, int $limit = 10, int $offset = 0): array
    {
        $res = $this->http()->get("{$this->url}/rest/v1/notifications", [
            'select'  => 'id,type,message,is_read,created_at,card_id,actor_id',
            'user_id' => "eq.{$userId}",
            'order'   => 'created_at.desc',
            'limit'   => $limit,
            'offset'  => $offset,
        ]);

        $notifications = $res->successful() ? $res->json() : [];

        // Enrich with actor profile
        return array_map(function ($notif) {
            if (!empty($notif['actor_id'])) {
                try {
                    $profile = $this->getProfile($notif['actor_id']);
                    $notif['actor'] = [
                        'username'     => $profile['username'] ?? null,
                        'display_name' => $profile['display_name'] ?? null,
                        'avatar_url'   => $profile['avatar_url'] ?? null,
                    ];
                } catch (\Throwable $e) {
                    $notif['actor'] = null;
                }
            }
            return $notif;
        }, $notifications);
    }

    public function markAllNotificationsRead(string $userId): void
    {
        $this->http()->patch(
            "{$this->url}/rest/v1/notifications?user_id=eq.{$userId}&is_read=eq.false",
            ['is_read' => true]
        );
    }

    public function markNotificationRead(string $id, string $userId): void
    {
        $this->http()->patch(
            "{$this->url}/rest/v1/notifications?id=eq.{$id}&user_id=eq.{$userId}",
            ['is_read' => true]
        );
    }
}