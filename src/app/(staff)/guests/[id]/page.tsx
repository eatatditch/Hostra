"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Textarea,
  TriggerBadge,
} from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import { format } from "date-fns";
import {
  User,
  Phone,
  Mail,
  AlertTriangle,
  Utensils,
  Calendar,
} from "lucide-react";

export default function GuestProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { locationId, isLoading: locLoading } = useLocation();
  const [noteContent, setNoteContent] = useState("");
  const [noteFlagged, setNoteFlagged] = useState(false);
  const [newTag, setNewTag] = useState("");

  const { data: profile, isLoading } = trpc.guest.getProfile.useQuery(
    { guestId: id, locationId },
    { enabled: !!locationId }
  );

  const addNoteMutation = trpc.guest.addNote.useMutation();
  const addTagMutation = trpc.guest.addTag.useMutation();
  const removeTagMutation = trpc.guest.removeTag.useMutation();
  const utils = trpc.useUtils();

  function invalidate() {
    utils.guest.getProfile.invalidate({ guestId: id, locationId });
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    await addNoteMutation.mutateAsync({
      guestId: id,
      content: noteContent,
      flagged: noteFlagged,
    });
    setNoteContent("");
    setNoteFlagged(false);
    invalidate();
  }

  async function handleAddTag() {
    if (!newTag.trim()) return;
    await addTagMutation.mutateAsync({ guestId: id, tag: newTag.trim() });
    setNewTag("");
    invalidate();
  }

  async function handleRemoveTag(tag: string) {
    await removeTagMutation.mutateAsync({ guestId: id, tag });
    invalidate();
  }

  if (locLoading || isLoading || !profile) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  const metrics = profile.metrics?.[0];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-bold">
            {profile.first_name} {profile.last_name}
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {formatPhone(profile.phone)}
            </span>
            {profile.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {profile.email}
              </span>
            )}
            {profile.date_of_birth && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Birthday: {format(new Date(profile.date_of_birth + "T00:00:00"), "MMMM d")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {profile.tags?.map((t: any) => (
              <Badge
                key={t.id}
                variant={t.tag === "VIP" ? "primary" : "default"}
                className="cursor-pointer"
                onClick={() => handleRemoveTag(t.tag)}
              >
                {t.tag} &times;
              </Badge>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddTag();
              }}
              className="inline-flex"
            >
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="text-xs border border-dashed border-border rounded-full px-2.5 py-0.5 bg-transparent focus:outline-none focus:border-primary w-20"
              />
            </form>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-primary">{metrics?.total_visits || 0}</p>
          <p className="text-xs text-text-muted">Total Visits</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-secondary">
            {metrics?.no_show_count || 0}
          </p>
          <p className="text-xs text-text-muted">No-Shows</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-accent">
            {metrics?.avg_party_size?.toFixed(1) || "—"}
          </p>
          <p className="text-xs text-text-muted">Avg Party</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-ditch-charcoal">
            {metrics?.last_visit_at
              ? format(new Date(metrics.last_visit_at), "MMM d")
              : "—"}
          </p>
          <p className="text-xs text-text-muted">Last Visit</p>
        </Card>
      </div>

      {/* Dietary Info */}
      {(profile.dietary_restrictions || profile.allergies) && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Utensils className="h-4 w-4 inline mr-1" />
              Dietary Info
            </CardTitle>
          </CardHeader>
          {profile.dietary_restrictions && (
            <p className="text-sm">
              <strong>Restrictions:</strong> {profile.dietary_restrictions}
            </p>
          )}
          {profile.allergies && (
            <p className="text-sm text-status-error">
              <strong>Allergies:</strong> {profile.allergies}
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[60px]"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={noteFlagged}
                  onChange={(e) => setNoteFlagged(e.target.checked)}
                  className="rounded"
                />
                <AlertTriangle className="h-3.5 w-3.5 text-status-error" />
                Flag as issue
              </label>
              <Button
                size="sm"
                onClick={handleAddNote}
                loading={addNoteMutation.isPending}
                disabled={!noteContent.trim()}
              >
                Add Note
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              {profile.notes?.length === 0 ? (
                <p className="text-sm text-text-muted py-2">No notes yet</p>
              ) : (
                profile.notes?.map((note: any) => (
                  <div
                    key={note.id}
                    className={`p-2 rounded text-sm ${note.flagged ? "bg-status-error/5 border border-status-error/20" : "bg-surface-alt"}`}
                  >
                    <p>{note.content}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                      {note.flagged && (
                        <span className="ml-2 text-status-error font-medium">
                          Flagged
                        </span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Visit History + Triggers */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visit History</CardTitle>
            </CardHeader>
            {profile.visits?.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No visits recorded</p>
            ) : (
              <div className="space-y-2">
                {profile.visits?.map((visit: any) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {format(new Date(visit.seated_at), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-text-muted">
                        Party of {visit.party_size}
                        {visit.table && ` · ${visit.table.label}`}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">
                      {format(new Date(visit.seated_at), "h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trigger History</CardTitle>
            </CardHeader>
            {profile.triggers?.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No triggers recorded</p>
            ) : (
              <div className="space-y-2">
                {profile.triggers?.map((trigger: any) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <TriggerBadge
                      type={trigger.trigger_type}
                      severity={trigger.severity}
                    />
                    <div className="text-xs text-text-muted text-right">
                      <p>{format(new Date(trigger.created_at), "MMM d")}</p>
                      {trigger.actioned && (
                        <p className="text-status-success">Actioned</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
