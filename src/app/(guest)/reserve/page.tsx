"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Input, Card, Textarea } from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Calendar, Clock, Users, Check, MapPin } from "lucide-react";

type Step = "location" | "details" | "time" | "confirm" | "done";

export default function ReservePage() {
  const [step, setStep] = useState<Step>("location");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [partySize, setPartySize] = useState(2);
  const [selectedTime, setSelectedTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");

  const { data: brand } = trpc.table.getBrandSettings.useQuery();

  const { data: publicLocations, isLoading: locationsLoading } =
    trpc.table.getPublicLocations.useQuery(undefined, {
      enabled: step === "location",
    });

  const selectedLocation = publicLocations?.find(l => l.id === locationId);

  const { data: slots, isLoading: slotsLoading } =
    trpc.reservation.getAvailability.useQuery(
      { locationId, date, partySize },
      { enabled: !!locationId && (step === "time" || step === "details") }
    );

  const createMutation = trpc.reservation.create.useMutation();

  function handleSelectLocation(id: string, name: string) {
    setLocationId(id);
    setLocationName(name);
    setStep("details");
  }

  function handleSelectDateParty() {
    setStep("time");
  }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    setStep("confirm");
  }

  async function handleConfirm() {
    const result = await createMutation.mutateAsync({
      locationId,
      firstName,
      lastName: lastName || undefined,
      phone,
      email: email || undefined,
      date,
      time: selectedTime,
      partySize,
      specialRequests: specialRequests || undefined,
    });
    setConfirmationToken(result.token);
    setStep("done");
  }

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  return (
    <div className="min-h-screen flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-10 mx-auto" />
          ) : (
            <h1 className="text-3xl font-display font-bold text-ditch-charcoal">
              {brand?.brand_name || "Ditch"}
            </h1>
          )}
          <p className="text-sm text-text-muted mt-1">Make a Reservation</p>
        </div>

        {/* Step: Location */}
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
                  No locations are currently available for reservations.
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

        {/* Step: Date & Party Size */}
        {step === "details" && (
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSelectDateParty();
              }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setStep("location")}
                className="text-sm text-primary hover:underline cursor-pointer"
              >
                &larr; Change location
              </button>

              <div className="flex items-center gap-2 text-sm bg-surface-alt rounded-lg p-3">
                <MapPin className="h-4 w-4 text-text-muted shrink-0" />
                <span className="font-medium text-text">{locationName}</span>
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

              <Input
                label="Date"
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
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
              <Button type="submit" className="w-full" size="lg">
                Find Times
              </Button>
            </form>
          </Card>
        )}

        {/* Step: Time Selection */}
        {step === "time" && (
          <Card>
            <div className="space-y-4">
              <button
                onClick={() => setStep("details")}
                className="text-sm text-primary hover:underline cursor-pointer"
              >
                &larr; Change date or party size
              </button>
              <div className="flex items-center gap-4 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {locationName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {partySize} {partySize === 1 ? "guest" : "guests"}
                </span>
              </div>

              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 bg-surface-alt rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : slots?.filter((s) => s.available).length === 0 ? (
                <p className="text-center py-6 text-text-muted">
                  No available times for this date and party size.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots
                    ?.filter((s) => s.available)
                    .map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => handleSelectTime(slot.time)}
                        className="px-3 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors cursor-pointer"
                      >
                        {formatTime12h(slot.time)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step: Contact & Confirm */}
        {step === "confirm" && (
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setStep("time")}
                className="text-sm text-primary hover:underline cursor-pointer"
              >
                &larr; Change time
              </button>

              <div className="flex items-center gap-4 text-sm bg-surface-alt rounded-lg p-3">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-text-muted" />
                  {locationName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  {format(new Date(date + "T00:00:00"), "MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-text-muted" />
                  {formatTime12h(selectedTime)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-text-muted" />
                  {partySize}
                </span>
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
              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Textarea
                label="Special Requests (optional)"
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Allergies, celebrations, seating preferences..."
                className="min-h-[60px]"
              />

              {createMutation.error && (
                <p className="text-sm text-status-error text-center">
                  {createMutation.error.message === "SLOT_UNAVAILABLE"
                    ? "This time slot is no longer available."
                    : createMutation.error.message === "DUPLICATE_RESERVATION"
                      ? "You already have a reservation for this date."
                      : "Something went wrong. Please try again."}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={createMutation.isPending}
              >
                Confirm Reservation
              </Button>
            </form>
          </Card>
        )}

        {/* Step: Confirmation */}
        {step === "done" && (
          <Card className="text-center">
            <div className="py-4 space-y-4">
              <div className="h-16 w-16 rounded-full bg-status-success/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-status-success" />
              </div>
              <h2 className="text-xl font-display font-bold">
                You&apos;re Confirmed!
              </h2>
              <div className="text-sm text-text-muted space-y-1">
                <p>{locationName}</p>
                <p>
                  {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")} at{" "}
                  {formatTime12h(selectedTime)}
                </p>
                <p>
                  Party of {partySize}
                </p>
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
              <p className="text-sm text-text-muted">
                A confirmation has been sent to your phone.
              </p>
              <a
                href={`/booking/${confirmationToken}`}
                className="text-sm text-primary hover:underline"
              >
                View or modify your reservation
              </a>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
