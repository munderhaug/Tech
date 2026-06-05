import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Clock, Hash, Send } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import type { ChatChannel, ChatMessage, ChatScope } from "@/domain/types";
import { Button, Card, CardContent, EmptyState, Input } from "@/components/ui/primitives";
import { cn, fmtTime, newId, nowIso } from "@/lib/utils";

const SCOPE_ORDER: ChatScope[] = ["ALL", "STAGE", "ARTIST", "DEPARTMENT"];
const SCOPE_LABEL: Record<ChatScope, string> = {
  ALL: "All-house",
  STAGE: "Stages",
  ARTIST: "Artists",
  DEPARTMENT: "Departments",
};

function Thread({ channel }: { channel: ChatChannel }) {
  const { user, online } = useApp();
  const [body, setBody] = React.useState("");
  const messages = useLiveQuery(() => getStore().messagesForChannel(channel.id), [channel.id]);
  const endRef = React.useRef<HTMLDivElement>(null);

  // Flush queued offline messages once connectivity returns (send-on-reconnect).
  React.useEffect(() => {
    if (!online) return;
    void (async () => {
      const store = getStore();
      const pending = (await store.messagesForChannel(channel.id)).filter(
        (m) => m.delivery === "pending",
      );
      for (const m of pending) {
        await store.chatMessages.put({ ...m, delivery: "sent" });
      }
    })();
  }, [online, channel.id, messages?.length]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const send = async () => {
    if (!body.trim()) return;
    const msg: ChatMessage = {
      id: newId(),
      channel_id: channel.id,
      author_id: user.id,
      author_name: user.name,
      body: body.trim(),
      created_at: nowIso(),
      client_uuid: newId(), // dedupe key on real sync
      delivery: online ? "sent" : "pending",
    };
    await getStore().chatMessages.put(msg);
    setBody("");
  };

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{channel.name}</span>
        <span className="text-xs text-muted-foreground">{channel.scope.toLowerCase()}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto py-3">
        {(messages ?? []).map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium">{m.author_name}</span>{" "}
            <span className="text-xs text-muted-foreground">{fmtTime(m.created_at)}</span>
            {m.delivery === "pending" && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-pending">
                <Clock className="h-3 w-3" /> queued
              </span>
            )}
            <p>{m.body}</p>
          </div>
        ))}
        {(messages?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t border-border pt-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={online ? "Message…" : "Offline — will send on reconnect"}
        />
        <Button size="icon" onClick={send} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { festivalId } = useApp();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const channels = useLiveQuery(async () => {
    if (!festivalId) return [];
    return (await getStore().chatChannels.all()).filter((c) => c.festival_id === festivalId);
  }, [festivalId]);

  if (!channels) return <EmptyState>Loading chat…</EmptyState>;
  const active = channels.find((c) => c.id === activeId) ?? channels[0];

  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col gap-3">
        {SCOPE_ORDER.map((scope) => {
          const list = channels.filter((c) => c.scope === scope);
          if (list.length === 0) return null;
          return (
            <div key={scope}>
              <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                {SCOPE_LABEL[scope]}
              </h3>
              <div className="flex flex-col gap-1">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm",
                      active?.id === c.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    <Hash className="h-3.5 w-3.5" />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-3">
          {active ? <Thread channel={active} /> : <EmptyState>No channels.</EmptyState>}
        </CardContent>
      </Card>
    </div>
  );
}
