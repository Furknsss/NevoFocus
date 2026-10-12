import React from 'react';
import { Plane, Calendar, Clock, MapPin, User, Tag, Sparkles } from 'lucide-react';
import { FlightAirport, FocusTask } from '../../types';

interface BoardingPassCardProps {
  passengerName: string;
  origin: FlightAirport;
  destination: FlightAirport;
  durationMinutes: number;
  flightCode?: string;
  seat?: string;
  gate?: string;
  selectedTask?: FocusTask | null;
  onSelectAnotherTask?: () => void;
}

export const BoardingPassCard: React.FC<BoardingPassCardProps> = ({
  passengerName,
  origin,
  destination,
  durationMinutes,
  flightCode = 'FK 0575',
  seat = '55L',
  gate = '22',
  selectedTask,
  onSelectAnotherTask,
}) => {
  const currentDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  }).toUpperCase();

  const currentTimeStr = new Date().toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="relative w-full max-w-2xl mx-auto drop-shadow-2xl font-sans select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Container with rounded border and card shadow */}
      <div className="relative overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-200">
        {/* Top Header Banner matching Image 2 */}
        <div className="bg-[#1b234b] text-white flex items-center justify-between px-6 sm:px-8 py-3.5 relative">
          {/* Left brand logo */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              {/* Airplane lines speed vector */}
              <div className="flex flex-col gap-0.5 mr-1 opacity-70">
                <span className="w-3 h-[1.5px] bg-white rounded-full"></span>
                <span className="w-5 h-[1.5px] bg-white rounded-full"></span>
                <span className="w-4 h-[1.5px] bg-white rounded-full"></span>
              </div>
              <Plane className="w-6 h-6 fill-white stroke-none -rotate-12" />
            </div>
            <span className="text-sm font-black tracking-widest uppercase">
              FOKUS AIRLINES
            </span>
          </div>

          <div className="text-center font-black tracking-widest text-xs sm:text-sm uppercase pr-28 sm:pr-40">
            BOARDING PASS
          </div>

          {/* Right stub header label */}
          <div className="absolute right-6 sm:right-8 font-black tracking-widest text-[11px] sm:text-xs uppercase text-slate-300 hidden sm:block">
            BOARDING PASS
          </div>
        </div>

        {/* Card Main Body */}
        <div className="flex flex-col sm:flex-row relative bg-white">
          {/* Main Flight Info (Left Section) */}
          <div className="flex-1 p-6 sm:p-7 sm:pr-8">
            {/* Passenger Name & Carrier */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Passenger Name
                </span>
                <span className="text-sm sm:text-base font-extrabold text-slate-800 uppercase tracking-tight block">
                  {passengerName || 'YOLCU'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Carrier
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-700 uppercase block">
                  FOKUS AIRWAYS
                </span>
              </div>
            </div>

            {/* From & To Route */}
            <div className="grid grid-cols-2 gap-4 mb-5 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  From
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight block uppercase">
                  {origin.city}
                </span>
                <span className="text-[11px] font-bold text-[#1b234b] font-mono">
                  {origin.name} ({origin.code})
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  To
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight block uppercase">
                  {destination.city}
                </span>
                <span className="text-[11px] font-bold text-[#1b234b] font-mono">
                  {destination.name} ({destination.code})
                </span>
              </div>
            </div>

            {/* Flight Metrics Grid matching Image 2 */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 font-mono">
                  {currentDateStr}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Time</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 font-mono">
                  {currentTimeStr}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Flight</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                  {flightCode}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Seat</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                  {seat}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Gate</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                  {gate}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Flight Duration</span>
                <span className="text-xs sm:text-sm font-black text-[#ff5500] font-mono">
                  {durationMinutes} MIN
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Board till</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                  {currentTimeStr}
                </span>
              </div>
            </div>

            {/* Attached Task Badge */}
            {selectedTask && (
              <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedTask.subjectColor }} />
                  <span className="text-xs font-bold text-slate-800 truncate max-w-xs">
                    Görev: {selectedTask.title}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {selectedTask.plannedMinutes} dk
                </span>
              </div>
            )}
          </div>

          {/* Vertical Barcode Matrix */}
          <div className="hidden sm:flex items-center justify-center px-4 py-4 border-r border-dashed border-slate-300 relative">
            {/* Top and Bottom Perforation Cutout Notches */}
            <div className="absolute -top-3 right-[-10px] w-5 h-5 rounded-full bg-[#0b0c10]"></div>
            <div className="absolute -bottom-3 right-[-10px] w-5 h-5 rounded-full bg-[#0b0c10]"></div>

            <div className="w-10 h-40 flex flex-col justify-between py-1 opacity-80">
              {/* Simulated high-density 2D flight barcode */}
              <div className="w-full h-full bg-[repeating-linear-gradient(0deg,#1e293b,#1e293b_2px,transparent_2px,transparent_4px)]"></div>
            </div>
          </div>

          {/* Detachable Passenger Stub (Right Section matching Image 2) */}
          <div className="w-full sm:w-52 p-5 sm:p-6 bg-slate-50/70 border-t sm:border-t-0 border-dashed border-slate-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Passenger Name</span>
                <span className="text-xs font-bold text-slate-800 uppercase truncate block">
                  {passengerName || 'YOLCU'}
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">From</span>
                <span className="text-xs font-extrabold text-slate-900 uppercase block">
                  {origin.city} ({origin.code})
                </span>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">To</span>
                <span className="text-xs font-extrabold text-slate-900 uppercase block">
                  {destination.city} ({destination.code})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[10px]">
                <div>
                  <span className="text-slate-400 block font-bold">Flight</span>
                  <span className="font-mono font-black text-slate-800">{flightCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">Seat</span>
                  <span className="font-mono font-black text-slate-800">{seat}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>GATE {gate}</span>
              <span className="font-bold text-[#ff5500]">{durationMinutes} DK</span>
            </div>
          </div>
        </div>

        {/* Bottom edge band */}
        <div className="bg-[#1b234b] h-2.5 w-full"></div>
      </div>
    </div>
  );
};
