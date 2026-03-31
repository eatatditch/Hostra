"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Input, Card } from "@/components/ui";
import { Check, Clock, MapPin } from "lucide-react";
import { minutesToHumanReadable } from "@/lib/utils";

type Step = "location" | "join" | "done";

export default function WaitlistJoinPage() {
  const [step, setStep] = useState<Step>("location");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [checkToken, setCheckToken] = useState("");
  const [estimatedWait, setEstimatedWait] = useState(0);

  const { data: brand } = trpc.table.getBrandSettings.useQuery();

  const { data: publicLocations, isLoading: locationsLoading } =
    trpc.table.getPublicLocations.useQuery(undefined, {
      enabled: step === "location",
    });

  const selectedLocation = publicLocations?.find(l => l.id === locationId);

  const joinMutation = trpc.waitlist.join.useMutation();

  function handleSelectLocation(id: string, name: string) {
    setLocationId(id);
    setLocationName(name);
    setStep("join");
  }

  async function handleJoin() {
    const result = await joinMutation.mutateAsync({
      locationId,
      firstName,
      lastName: lastName || undefined,
      phone,
      partySize,
      source: "web",
    });
    setCheckToken(result.token);
    setEstimatedWait(result.entry.estimatedWaitMinutes || 0);
    setStep("done");
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-10 mx-auto" />
          ) : (
            <h1 className="text-3xl font-display font-bold text-ditch-charcoal">
              {brand?.brand_name || "Ditch"}
            </h1>
          )}
          <p className="text-sm text-text-muted mt-1">Join the Waitlist</p>
        </div>

        {step === "location" && (
          <Card>
            <div className="space-y-4">
              <h2 className="text-lg font-display font-semibold text-text">
                Choose a Location
              </h2>

              {locationsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-20 bg-surface-alt rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : !publicLocations || publicLocations.length === 0 ? (
                <p className="text-center py-6 text-text-muted">
                  No locations are currently available.
                </p>
              ) : (
                <div className="space-y-3">
                  {publicLocations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc.id, loc.name)}
                      className="w-full text-left p-4 rounded-lg border border-border bg-white hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="font-semibold text-text">{loc.name}</div>
                      {loc.address && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-text-muted">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {loc.address}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {step === "join" && (
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-1.5 text-sm text-text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{locationName}</span>
              </div>

              {selectedLocation && (
                <div className="bg-surface-alt rounded-lg p-3 space-y-1 text-sm text-text-muted">
                  {selectedLocation.address && <p>{selectedLocation.address}</p>}
                  {selectedLocation.phone && <p>{selectedLocation.phone}</p>}
                  {selectedLocation.address && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedLocation.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                    >
                      Get Directions →
                    </a>
                  )}
                  {brand?.website_url && (
                    <a
                      href={brand.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                    >
                      Visit Our Website →
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                required
              />
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Party Size
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPartySize(n)}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                        partySize === n
                          ? "bg-primary text-white border-primary"
                          : "bg-white border-border text-text hover:border-primary"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {joinMutation.error && (
                <p className="text-sm text-status-error text-center">
                  {joinMutation.error.message === "ALREADY_ON_WAITLIST"
                    ? "You're already on the waitlist!"
                    : "Something went wrong. Please try again."}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={joinMutation.isPending}
              >
                Join Waitlist
              </Button>
            </form>
          </Card>
        )}

        {step === "done" && (
          <Card className="text-center">
            <div className="py-4 space-y-4">
              <div className="h-16 w-16 rounded-full bg-status-success/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-status-success" />
              </div>
              <h2 className="text-xl font-display font-bold">
                You&apos;re On the List!
              </h2>
              <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{locationName}</span>
              </div>
              {selectedLocation && (
                <div className="bg-surface-alt rounded-lg p-3 space-y-1 text-sm text-text-muted text-left">
                  {selectedLocation.address && <p>{selectedLocation.address}</p>}
                  {selectedLocation.phone && <p>{selectedLocation.phone}</p>}
                  {selectedLocation.address && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedLocation.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                    >
                      Get Directions →
                    </a>
                  )}
                  {brand?.website_url && (
                    <a
                      href={brand.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                    >
                      Visit Our Website →
                    </a>
                  )}
                </div>
              )}
              {estimatedWait > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                  <Clock className="h-4 w-4" />
                  <span>
                    Estimated wait: ~{minutesToHumanReadable(estimatedWait)}
                  </span>
                </div>
              )}
              <p className="text-sm text-text-muted">
                We&apos;ll text you when your table is ready.
              </p>
              <a
                href={`/waitlist-status/${checkToken}`}
                className="text-sm text-primary hover:underline"
              >
                Check your status
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
