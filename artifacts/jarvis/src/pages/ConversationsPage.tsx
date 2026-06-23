import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useListConversations, useGetConversation, useCreateConversation, useDeleteConversation, getListConversationsQueryKey, getGetConversationQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Clock, MessageSquare, MessagesSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLocalStorage } from '@/hooks/use-local-storage';

export const ConversationsPage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [, setActiveConversationId] = useLocalStorage<number | null>('activeConversationId', null);
  const [, setLocation] = useLocation();

  const cleanMessageContent = (role: string, content: string | null | undefined) => {
    if (!content) return '';
    if (role === 'user') {
      return content.replace(/^\[System Note - Your Relationship with User:.*?\]\s*/is, '');
    } else {
      return content
        .replace(/\[anim:\s*[^\]]+?\s*\]/gi, '')
        .replace(/\[draw:\s*.+?\]/gi, '')
        .replace(/\[Orchestrator\]:/g, '')
        .replace(/\[\s*\w+\s*:\s*[^\]]+\]/g, '')
        .trim();
    }
  };

  const { data: conversations, isLoading: isLoadingList } = useListConversations();
  const { data: detail, isLoading: isLoadingDetail } = useGetConversation(selectedId!, { query: { queryKey: getGetConversationQueryKey(selectedId!), enabled: !!selectedId } });

  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = () => {
    createConv.mutate({ data: { title: `Chat ${format(new Date(), 'MMM d, HH:mm')}` } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setSelectedId(data.id);
        setActiveConversationId(data.id);
        toast({ title: "New conversation created" });
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        if (selectedId === id) { setSelectedId(null); setActiveConversationId(null); }
        toast({ title: "Conversation deleted" });
      }
    });
  };

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-7xl mx-auto w-full">
      <header className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-foreground">History</h2>
          <p className="text-sm text-muted-foreground mt-0.5">All past conversations</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createConv.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="button-create-conversation"
        >
          <Plus size={16} /> New
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0 overflow-hidden">

        {/* List */}
        <div className="md:col-span-1 rounded-xl border border-border bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border bg-slate-50 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingList ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : !conversations?.length ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedId === conv.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  data-testid={`item-conversation-${conv.id}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-sm text-foreground truncate">{conv.title}</p>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                      data-testid={`button-delete-${conv.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={11} /> {format(new Date(conv.updatedAt), 'MMM d, HH:mm')}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={11} /> {conv.messageCount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="md:col-span-2 rounded-xl border border-border bg-white flex flex-col overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
              <MessagesSquare size={36} className="opacity-20" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          ) : isLoadingDetail ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : detail ? (
            <>
              <div className="p-4 border-b border-border bg-slate-50 shrink-0 flex justify-between items-center">
                <p className="font-semibold text-sm text-foreground truncate pr-4">{detail.title}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setActiveConversationId(detail.id);
                      setLocation('/');
                      toast({ title: "Conversation loaded", description: "You can now continue this chat." });
                    }}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    Resume Chat
                  </button>
                  <p className="text-xs text-muted-foreground">#{detail.id}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {detail.messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">No messages</p>
                ) : (
                  detail.messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1 px-1">
                        {msg.role === 'user' ? 'You' : 'JARVIS'} · {format(new Date(msg.createdAt), 'HH:mm')}
                      </p>
                      <div className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-slate-100 text-foreground rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap">{cleanMessageContent(msg.role, msg.content)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
