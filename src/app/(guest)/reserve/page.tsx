"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button, Input, Textarea } from "@/components/ui";
import { formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Calendar, Clock, Users, Check, MapPin, Phone, Globe, Navigation, Waves } from "lucide-react";

type Step = "location" | "details" | "time" | "confirm" | "done";

function WaveSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,64 C240,120 480,0 720,64 C960,128 1200,0 1440,64 L1440,120 L0,120 Z" fill="currentColor" opacity="0.08" />
      <path d="M0,80 C360,20 720,100 1080,40 C1260,10 1360,50 1440,80 L1440,120 L0,120 Z" fill="currentColor" opacity="0.05" />
    </svg>
  );
}

function ContactInfo({ location, brand, compact }: { location: any; brand: any; compact?: boolean }) {
  if (!location) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-xs" : "text-sm"} text-ditch-blue-dark/70`}>
      {location.address && (
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {location.address}
        </span>
      )}
      {location.phone && (
        <a href={`tel:${location.phone}`} className="flex items-center gap-1 hover:text-ditch-blue transition-colors">
          <Phone className="h-3.5 w-3.5" />
          {location.phone}
        </a>
      )}
      {location.address && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors"
        >
          <Navigation className="h-3.5 w-3.5" />
          Directions
        </a>
      )}
      {brand?.website_url && (
        <a
          href={brand.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors"
        >
          <Globe className="h-3.5 w-3.5" />
          Website
        </a>
      )}
    </div>
  );
}

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
    trpc.table.getPublicLocations.useQuery(undefined, { enabled: step === "location" });
  const selectedLocation = publicLocations?.find((l: any) => l.id === locationId);

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

  function handleSelectDateParty() { setStep("time"); }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    setStep("confirm");
  }

  async function handleConfirm() {
    const result = await createMutation.mutateAsync({
      locationId, firstName, lastName: lastName || undefined, phone,
      email: email || undefined, date, time: selectedTime, partySize,
      specialRequests: specialRequests || undefined,
    });
    setConfirmationToken(result.token);
    setStep("done");
  }

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  return (
    <div className="min-h-screen bg-gradient-to-b from-ditch-blue/5 via-surface to-ditch-sand relative overflow-hidden">
      {/* Decorative wave at top */}
      <div className="absolute top-0 left-0 right-0 text-ditch-blue">
        <WaveSvg className="w-full h-24" />
      </div>

      {/* Subtle wave at bottom */}
      <div className="absolute bottom-0 left-0 right-0 text-ditch-green rotate-180">
        <WaveSvg className="w-full h-20" />
      </div>

      <div className="relative z-10 flex items-start justify-center pt-10 sm:pt-16 px-4 pb-20">
        <div className="w-full max-w-md">

          {/* Brand Header */}
          <div className="text-center mb-10">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-14 mx-auto mb-3" />
            ) : (
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-ditch-charcoal tracking-tight">
                {brand?.brand_name || "Ditch"}
              </h1>
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <Waves className="h-4 w-4 text-ditch-blue/40" />
              <p className="text-sm text-ditch-blue-dark/60 font-medium tracking-wide uppercase">
                Reserve a Table
              </p>
              <Waves className="h-4 w-4 text-ditch-blue/40" />
            </div>
          </div>

          {/* Step: Location */}
          {step === "location" && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-display font-semibold text-ditch-charcoal">
                Where are you dining?
              </h2>

              {locationsLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-24 bg-white/60 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : !publicLocations || publicLocations.length === 0 ? (
                <p className="text-center py-8 text-text-muted">
                  No locations are currently available.
                </p>
              ) : (
                <div className="space-y-3">
                  {publicLocations.map((loc: any) => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc.id, loc.name)}
                      className="w-full text-left p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-md hover:border-ditch-orange/30 hover:bg-white transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-semibold text-lg text-ditch-charcoal group-hover:text-ditch-orange transition-colors">
                            {loc.name}
                          </div>
                          {loc.address && (
                            <div className="flex items-center gap-1.5 mt-1 text-sm text-ditch-blue-dark/60">
                              <MapPin className="h-3.5 w-3.5" />
                              {loc.address}
                            </div>
                          )}
                          {loc.phone && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-ditch-blue-dark/60">
                              <Phone className="h-3.5 w-3.5" />
                              {loc.phone}
                            </div>
                          )}
                        </div>
                        <div className="text-ditch-orange opacity-0 group-hover:opacity-100 transition-opacity text-2xl">
                          &rsaquo;
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Date & Party Size */}
          {step === "details" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleSelectDateParty(); }} className="space-y-5">
                <button type="button" onClick={() => setStep("location")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer">
                  &larr; Change location
                </button>

                {/* Location pill */}
                <div className="bg-ditch-blue/5 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ditch-blue" />
                    <span className="font-display font-semibold text-ditch-charcoal">{locationName}</span>
                  </div>
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ditch-charcoal mb-2">When?</label>
                  <input
                    type="date"
                    value={date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-ditch-sand-dark bg-white text-ditch-charcoal focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ditch-charcoal mb-2">How many guests?</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPartySize(n)}
                        className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                          partySize === n
                            ? "bg-ditch-orange text-white border-ditch-orange shadow-sm scale-105"
                            : "bg-white border-ditch-sand-dark text-ditch-charcoal hover:border-ditch-orange/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-ditch-orange text-white font-semibold text-lg hover:bg-ditch-orange-dark transition-colors shadow-sm hover:shadow-md cursor-pointer"
                >
                  Find Available Times
                </button>
              </form>
            </div>
          )}

          {/* Step: Time Selection */}
          {step === "time" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6 space-y-5">
              <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer">
                &larr; Change date or party size
              </button>

              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-ditch-blue-dark/70">
                <span className="flex items-center gap-1.5 bg-ditch-blue/5 px-3 py-1.5 rounded-full">
                  <MapPin className="h-3.5 w-3.5 text-ditch-blue" />
                  {locationName}
                </span>
                <span className="flex items-center gap-1.5 bg-ditch-blue/5 px-3 py-1.5 rounded-full">
                  <Calendar className="h-3.5 w-3.5 text-ditch-blue" />
                  {format(new Date(date + "T00:00:00"), "EEE, MMM d")}
                </span>
                <span className="flex items-center gap-1.5 bg-ditch-blue/5 px-3 py-1.5 rounded-full">
                  <Users className="h-3.5 w-3.5 text-ditch-blue" />
                  {partySize} {partySize === 1 ? "guest" : "guests"}
                </span>
              </div>

              <h3 className="font-display font-semibold text-ditch-charcoal">Pick your time</h3>

              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 bg-ditch-sand/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : slots?.filter((s) => s.available).length === 0 ? (
                <div className="text-center py-8">
                  <Waves className="h-8 w-8 text-ditch-blue/20 mx-auto mb-2" />
                  <p className="text-text-muted">No available times for this date.</p>
                  <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:underline mt-2 cursor-pointer">
                    Try a different date
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots?.filter((s) => s.available).map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => handleSelectTime(slot.time)}
                      className="py-3 rounded-xl border-2 border-ditch-sand-dark bg-white text-sm font-semibold text-ditch-charcoal hover:bg-ditch-orange hover:text-white hover:border-ditch-orange hover:scale-105 transition-all cursor-pointer"
                    >
                      {formatTime12h(slot.time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Contact & Confirm */}
          {step === "confirm" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }} className="space-y-5">
                <button type="button" onClick={() => setStep("time")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer">
                  &larr; Change time
                </button>

                {/* Reservation summary */}
                <div className="bg-gradient-to-r from-ditch-blue/5 to-ditch-green/5 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 font-display font-semibold text-ditch-charcoal">
                    <MapPin className="h-4 w-4 text-ditch-blue" />
                    {locationName}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-ditch-blue-dark/70">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(date + "T00:00:00"), "EEEE, MMM d")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime12h(selectedTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {partySize} {partySize === 1 ? "guest" : "guests"}
                    </span>
                  </div>
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>

                <h3 className="font-display font-semibold text-ditch-charcoal">Your details</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ditch-charcoal/70 mb-1">First Name</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-ditch-sand-dark bg-white focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ditch-charcoal/70 mb-1">Last Name</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-ditch-sand-dark bg-white focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ditch-charcoal/70 mb-1">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" required className="w-full px-3 py-2.5 rounded-xl border border-ditch-sand-dark bg-white focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ditch-charcoal/70 mb-1">Email <span className="text-ditch-blue-dark/40">(optional)</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-3 py-2.5 rounded-xl border border-ditch-sand-dark bg-white focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ditch-charcoal/70 mb-1">Special Requests <span className="text-ditch-blue-dark/40">(optional)</span></label>
                  <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Allergies, celebrations, seating preferences..." className="w-full px-3 py-2.5 rounded-xl border border-ditch-sand-dark bg-white focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange text-sm min-h-[70px] resize-y" />
                </div>

                {createMutation.error && (
                  <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded-xl">
                    {createMutation.error.message === "SLOT_UNAVAILABLE"
                      ? "This time slot is no longer available."
                      : createMutation.error.message === "DUPLICATE_RESERVATION"
                        ? "You already have a reservation for this date."
                        : "Something went wrong. Please try again."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full py-3.5 rounded-xl bg-ditch-orange text-white font-semibold text-lg hover:bg-ditch-orange-dark transition-colors shadow-sm hover:shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending ? "Confirming..." : "Confirm Reservation"}
                </button>
              </form>
            </div>
          )}

          {/* Step: Confirmation */}
          {step === "done" && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-8 text-center space-y-5">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-ditch-green/10 flex items-center justify-center mx-auto">
                  <Check className="h-10 w-10 text-ditch-green" />
                </div>
                <Waves className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-5 w-5 text-ditch-blue/30" />
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold text-ditch-charcoal">
                  See you there!
                </h2>
                <p className="text-sm text-ditch-blue-dark/60 mt-1">Your table is reserved.</p>
              </div>

              {/* Reservation card */}
              <div className="bg-gradient-to-br from-ditch-blue/5 via-white to-ditch-green/5 rounded-xl p-5 space-y-3 text-left border border-ditch-sand-dark/50">
                <div className="font-display font-semibold text-ditch-charcoal">{locationName}</div>
                <div className="flex flex-wrap gap-4 text-sm text-ditch-blue-dark/70">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-ditch-blue" />
                    {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-ditch-blue" />
                    {formatTime12h(selectedTime)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-ditch-blue" />
                    Party of {partySize}
                  </span>
                </div>
                <div className="pt-2 border-t border-ditch-sand-dark/30">
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>
              </div>

              <p className="text-sm text-ditch-blue-dark/50">
                A confirmation has been sent to your phone.
              </p>

              <a
                href={`/booking/${confirmationToken}`}
                className="inline-block text-sm font-medium text-ditch-orange hover:text-ditch-orange-dark transition-colors"
              >
                View or modify your reservation &rarr;
              </a>
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-8 text-xs text-ditch-blue-dark/30">
            Powered by HostOS
          </div>
        </div>
      </div>
    </div>
  );
}
