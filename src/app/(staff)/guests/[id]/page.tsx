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
            {profile.firstName} {profile.lastName}
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-muted">
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
          <p className="text-2xl font-bold text-primary">{metrics?.totalVisits || 0}</p>
          <p className="text-xs text-text-muted">Total Visits</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-secondary">
            {metrics?.noShowCount || 0}
          </p>
          <p className="text-xs text-text-muted">No-Shows</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-accent">
            {metrics?.avgPartySize?.toFixed(1) || "—"}
          </p>
          <p className="text-xs text-text-muted">Avg Party</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-ditch-charcoal">
            {metrics?.lastVisitAt
              ? format(new Date(metrics.lastVisitAt), "MMM d")
              : "—"}
          </p>
          <p className="text-xs text-text-muted">Last Visit</p>
        </Card>
      </div>

      {/* Dietary Info */}
      {(profile.dietaryRestrictions || profile.allergies) && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Utensils className="h-4 w-4 inline mr-1" />
              Dietary Info
            </CardTitle>
          </CardHeader>
          {profile.dietaryRestrictions && (
            <p className="text-sm">
              <strong>Restrictions:</strong> {profile.dietaryRestrictions}
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
                      {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
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
                        {format(new Date(visit.seatedAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-text-muted">
                        Party of {visit.partySize}
                        {visit.table && ` · ${visit.table.label}`}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted">
                      {format(new Date(visit.seatedAt), "h:mm a")}
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
                      type={trigger.triggerType}
                      severity={trigger.severity}
                    />
                    <div className="text-xs text-text-muted text-right">
                      <p>{format(new Date(trigger.createdAt), "MMM d")}</p>
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
