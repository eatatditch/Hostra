"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatTime12h } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Calendar, Clock, Users, Check, MapPin, Phone, Globe, Navigation, Waves } from "lucide-react";
import { HostOSLogo } from "@/components/ui";
import { DepositPayment } from "@/components/shared/deposit-payment";

type Step = "location" | "details" | "time" | "confirm" | "deposit" | "done";

function TopWaves() {
  return (
    <svg className="w-full h-36 sm:h-44" viewBox="0 0 1440 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,80 C180,140 360,30 540,90 C720,150 900,20 1080,80 C1200,120 1320,60 1440,100 L1440,180 L0,180 Z" fill="#1a3a4f" />
      <path d="M0,100 C240,50 480,150 720,90 C960,30 1200,130 1440,70 L1440,180 L0,180 Z" fill="#243c4e" />
      <path d="M0,120 C300,80 600,150 900,100 C1100,70 1300,120 1440,110 L1440,180 L0,180 Z" fill="#325269" />
      <path d="M0,140 C360,110 720,160 1080,130 C1260,115 1380,140 1440,135 L1440,180 L0,180 Z" fill="#3d6280" />
      <path d="M0,155 C200,145 500,165 800,150 C1050,140 1300,158 1440,152 L1440,180 L0,180 Z" fill="#4a7494" opacity="0.6" />
    </svg>
  );
}

function BottomWaves() {
  return (
    <svg className="w-full h-28 sm:h-36" viewBox="0 0 1440 140" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,50 C240,100 480,10 720,60 C960,110 1200,20 1440,70 L1440,0 L0,0 Z" fill="#3d6280" opacity="0.5" />
      <path d="M0,35 C300,80 700,5 1000,50 C1200,75 1350,30 1440,45 L1440,0 L0,0 Z" fill="#325269" opacity="0.4" />
      <path d="M0,20 C400,50 800,0 1200,30 C1350,40 1400,20 1440,25 L1440,0 L0,0 Z" fill="#243c4e" opacity="0.3" />
    </svg>
  );
}

function ContactInfo({ location, brand, compact }: { location: any; brand: any; compact?: boolean }) {
  if (!location) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      {location.address && (
        <span className="flex items-center gap-1 text-ditch-blue-dark/60">
          <MapPin className="h-3.5 w-3.5" /> {location.address}
        </span>
      )}
      {location.phone && (
        <a href={`tel:${location.phone}`} className="flex items-center gap-1 text-ditch-blue-dark/60 hover:text-ditch-blue transition-colors">
          <Phone className="h-3.5 w-3.5" /> {location.phone}
        </a>
      )}
      {location.address && (
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors font-medium">
          <Navigation className="h-3.5 w-3.5" /> Directions
        </a>
      )}
      {brand?.website_url && (
        <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ditch-orange hover:text-ditch-orange-dark transition-colors font-medium">
          <Globe className="h-3.5 w-3.5" /> Website
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
  const [depositInfo, setDepositInfo] = useState<{
    clientSecret: string;
    amountCents: number;
  } | null>(null);

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

  function handleSelectLocation(id: string, name: string) { setLocationId(id); setLocationName(name); setStep("details"); }
  function handleSelectDateParty() { setStep("time"); }
  function handleSelectTime(time: string) { setSelectedTime(time); setStep("confirm"); }
  async function handleConfirm() {
    const result = await createMutation.mutateAsync({
      locationId, firstName, lastName: lastName || undefined, phone,
      email: email || undefined, date, time: selectedTime, partySize,
      specialRequests: specialRequests || undefined,
    });
    setConfirmationToken(result.token);
    if (result.deposit?.clientSecret) {
      setDepositInfo({
        clientSecret: result.deposit.clientSecret,
        amountCents: result.deposit.amountCents,
      });
      setStep("deposit");
    } else {
      setStep("done");
    }
  }

  const minDate = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const inputClass = "w-full px-4 py-3 rounded-xl border border-ditch-sand-dark bg-white text-ditch-charcoal placeholder:text-ditch-blue-dark/30 focus:outline-none focus:ring-2 focus:ring-ditch-orange/30 focus:border-ditch-orange transition-all text-sm";

  return (
    <div className="min-h-screen bg-surface relative overflow-hidden">
      {/* Top waves — layered Ditch blues */}
      <div className="absolute top-0 left-0 right-0">
        <TopWaves />
      </div>

      {/* Bottom waves */}
      <div className="absolute bottom-0 left-0 right-0">
        <BottomWaves />
      </div>

      <div className="relative z-10 flex items-start justify-center pt-44 sm:pt-52 px-4 pb-44">
        <div className="w-full max-w-md">

          {/* Brand Header */}
          <div className="text-center mb-10">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.brand_name || "Ditch"} className="h-12 max-w-[200px] object-contain mx-auto mb-2" />
            ) : (
              <h1 className="text-5xl sm:text-6xl font-display font-bold text-ditch-charcoal tracking-tight">
                {brand?.brand_name || "Ditch"}
              </h1>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className="h-px w-12 bg-ditch-orange/30" />
              <p className="text-sm font-display italic text-ditch-orange">Reserve a Table</p>
              <div className="h-px w-12 bg-ditch-orange/30" />
            </div>
          </div>

          {/* Step: Location */}
          {step === "location" && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-display text-ditch-charcoal">Where are you dining?</h2>
              {locationsLoading ? (
                <div className="space-y-3">
                  {[...Array(2)].map((_, i) => (<div key={i} className="h-28 bg-white/60 rounded-2xl animate-pulse" />))}
                </div>
              ) : !publicLocations || publicLocations.length === 0 ? (
                <p className="text-center py-8 text-text-muted">No locations available.</p>
              ) : (
                <div className="space-y-3">
                  {publicLocations.map((loc: any) => (
                    <button key={loc.id} onClick={() => handleSelectLocation(loc.id, loc.name)}
                      className="w-full text-left p-5 rounded-2xl bg-white border border-border shadow-sm hover:shadow-md hover:border-ditch-orange/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display font-semibold text-lg text-ditch-charcoal group-hover:text-ditch-orange transition-colors">{loc.name}</div>
                          {loc.address && (<p className="text-sm text-text-muted mt-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {loc.address}</p>)}
                          {loc.phone && (<p className="text-sm text-text-muted mt-0.5 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {loc.phone}</p>)}
                        </div>
                        <span className="text-ditch-orange text-2xl opacity-0 group-hover:opacity-100 transition-opacity">&rsaquo;</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Date & Party Size */}
          {step === "details" && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
              <button type="button" onClick={() => setStep("location")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">&larr; Change location</button>
              <div className="bg-ditch-blue/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-ditch-blue" /><span className="font-display font-semibold text-ditch-charcoal">{locationName}</span></div>
                <ContactInfo location={selectedLocation} brand={brand} compact />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSelectDateParty(); }} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ditch-charcoal/80 mb-2">When?</label>
                  <input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ditch-charcoal/80 mb-2">How many guests?</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <button key={n} type="button" onClick={() => setPartySize(n)}
                        className={`w-11 h-11 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${partySize === n ? "bg-ditch-orange text-white border-ditch-orange shadow-sm scale-105" : "bg-white border-border text-ditch-charcoal hover:border-ditch-orange/40"}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl bg-ditch-orange text-white font-semibold text-lg hover:bg-ditch-orange-dark transition-colors shadow-sm cursor-pointer">
                  Find Available Times
                </button>
              </form>
            </div>
          )}

          {/* Step: Time Selection */}
          {step === "time" && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
              <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">&larr; Back</button>
              <div className="flex flex-wrap items-center gap-2">
                {[{ icon: MapPin, text: locationName }, { icon: Calendar, text: format(new Date(date + "T00:00:00"), "EEE, MMM d") }, { icon: Users, text: `${partySize} ${partySize === 1 ? "guest" : "guests"}` }].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-ditch-blue/7 text-ditch-blue-dark">
                    <item.icon className="h-3.5 w-3.5 text-ditch-blue" /> {item.text}
                  </span>
                ))}
              </div>
              <h3 className="font-display text-ditch-charcoal text-lg">Pick your time</h3>
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">{[...Array(6)].map((_, i) => (<div key={i} className="h-12 bg-surface-alt rounded-xl animate-pulse" />))}</div>
              ) : slots?.filter((s) => s.available).length === 0 ? (
                <div className="text-center py-10">
                  <Waves className="h-10 w-10 mx-auto mb-3 text-ditch-blue/20" />
                  <p className="text-text-muted">No times available for this date.</p>
                  <button onClick={() => setStep("details")} className="text-sm text-ditch-orange hover:underline mt-2 cursor-pointer">Try a different date</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots?.filter((s) => s.available).map((slot) => (
                    <button key={slot.time} onClick={() => handleSelectTime(slot.time)}
                      className="py-3 rounded-xl border-2 border-border bg-white text-sm font-semibold text-ditch-charcoal hover:bg-ditch-orange hover:text-white hover:border-ditch-orange hover:scale-105 transition-all cursor-pointer"
                    >{formatTime12h(slot.time)}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }} className="space-y-5">
                <button type="button" onClick={() => setStep("time")} className="text-sm text-ditch-orange hover:text-ditch-orange-dark transition-colors cursor-pointer font-medium">&larr; Back</button>
                <div className="bg-ditch-blue/5 rounded-xl p-4 space-y-2">
                  <div className="font-display font-semibold text-ditch-charcoal flex items-center gap-2"><MapPin className="h-4 w-4 text-ditch-blue" /> {locationName}</div>
                  <div className="flex flex-wrap gap-3 text-sm text-ditch-blue-dark/60">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(date + "T00:00:00"), "EEEE, MMM d")}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime12h(selectedTime)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {partySize} {partySize === 1 ? "guest" : "guests"}</span>
                  </div>
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>
                <h3 className="font-display text-ditch-charcoal text-lg">Your details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">First Name</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputClass} /></div>
                  <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Last Name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} /></div>
                </div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Phone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" required className={inputClass} /></div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Email <span className="opacity-40">(optional)</span></label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} /></div>
                <div><label className="block text-xs font-semibold text-ditch-charcoal/60 mb-1">Special Requests <span className="opacity-40">(optional)</span></label><textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Allergies, celebrations, seating preferences..." className={`${inputClass} min-h-[70px] resize-y`} /></div>
                {createMutation.error && (
                  <p className="text-sm text-status-error text-center bg-status-error/5 p-2 rounded-xl">
                    {createMutation.error.message === "SLOT_UNAVAILABLE" ? "This time slot is no longer available."
                      : createMutation.error.message === "DUPLICATE_RESERVATION" ? "You already have a reservation for this date."
                      : "Something went wrong. Please try again."}
                  </p>
                )}
                <button type="submit" disabled={createMutation.isPending} className="w-full py-3.5 rounded-xl bg-ditch-orange text-white font-semibold text-lg hover:bg-ditch-orange-dark disabled:opacity-50 transition-colors shadow-sm cursor-pointer">
                  {createMutation.isPending ? "Confirming..." : "Confirm Reservation"}
                </button>
              </form>
            </div>
          )}

          {/* Step: Deposit */}
          {step === "deposit" && depositInfo && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
              <div className="bg-ditch-blue/5 rounded-xl p-4 space-y-2">
                <div className="font-display font-semibold text-ditch-charcoal flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ditch-blue" /> {locationName}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-ditch-blue-dark/60">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(date + "T00:00:00"), "EEEE, MMM d")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime12h(selectedTime)}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {partySize} {partySize === 1 ? "guest" : "guests"}</span>
                </div>
              </div>
              <h3 className="font-display text-ditch-charcoal text-lg">Authorize your deposit</h3>
              <p className="text-xs text-text-muted">
                Parties of {partySize} require a card hold to confirm. Your reservation is not finalized until this step completes.
              </p>
              <DepositPayment
                clientSecret={depositInfo.clientSecret}
                amountCents={depositInfo.amountCents}
                returnUrl={typeof window !== "undefined" ? `${window.location.origin}/booking/${confirmationToken}` : "/"}
                onSuccess={() => setStep("done")}
              />
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-8 text-center space-y-6">
              <div className="h-20 w-20 rounded-full bg-ditch-green/10 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-ditch-green" />
              </div>
              <div>
                <h2 className="text-3xl font-display font-bold text-ditch-charcoal">See you there!</h2>
                <p className="text-sm text-text-muted mt-1">Your table is reserved.</p>
              </div>
              <div className="bg-ditch-blue/5 rounded-xl p-5 space-y-3 text-left">
                <div className="font-display font-semibold text-ditch-charcoal text-lg">{locationName}</div>
                <div className="flex flex-wrap gap-4 text-sm text-ditch-blue-dark/60">
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-ditch-blue" /> {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-ditch-blue" /> {formatTime12h(selectedTime)}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-ditch-blue" /> Party of {partySize}</span>
                </div>
                <div className="pt-3 border-t border-border">
                  <ContactInfo location={selectedLocation} brand={brand} compact />
                </div>
              </div>
              <p className="text-sm text-text-muted">A confirmation has been sent to your phone.</p>
              <a href={`/booking/${confirmationToken}`} className="inline-block text-sm font-semibold text-ditch-orange hover:text-ditch-orange-dark transition-colors">
                View or modify your reservation &rarr;
              </a>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-10 opacity-20">
            <span className="text-[10px] uppercase tracking-[0.2em] text-ditch-blue">Powered by</span>
            <HostOSLogo size="xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
