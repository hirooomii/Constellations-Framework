<?php

namespace App\Services;

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;
use Illuminate\Support\Facades\Log;

class PushService
{
    private WebPush $webPush;

    public function __construct(private SupabaseService $supabase)
    {
        $this->webPush = new WebPush([
            'VAPID' => [
                'subject'    => env('VAPID_SUBJECT', 'mailto:admin@celestia.app'),
                'publicKey'  => env('VAPID_PUBLIC_KEY', ''),
                'privateKey' => env('VAPID_PRIVATE_KEY', ''),
            ],
        ]);
        $this->webPush->setReuseVAPIDHeaders(true);
    }

    public function sendToUser(string $userId, string $title, string $body, string $url = '/', string $tag = 'celestia-notif'): void
    {
        if (!env('VAPID_PUBLIC_KEY')) return;

        $subscriptions = $this->supabase->getPushSubscriptions($userId);
        if (empty($subscriptions)) return;

        $payload = json_encode(compact('title', 'body', 'url', 'tag'));

        foreach ($subscriptions as $sub) {
            try {
                $this->webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $sub['endpoint'],
                        'keys'     => ['p256dh' => $sub['p256dh'], 'auth' => $sub['auth']],
                    ]),
                    $payload
                );
            } catch (\Throwable $e) {
                Log::warning('Push queue error: ' . $e->getMessage());
            }
        }

        foreach ($this->webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                $this->supabase->deletePushSubscriptionByEndpoint($report->getEndpoint());
            }
        }
    }
}
