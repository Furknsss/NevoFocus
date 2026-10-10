import React from 'react';
import { FlightAirport } from '../../types';
import { RealisticEarthGlobe } from './RealisticEarthGlobe';

interface InteractiveFlightGlobeProps {
  origin: FlightAirport;
  destination: FlightAirport;
  progress: number; // 0 to 1
  isFlightActive?: boolean;
}

export const InteractiveFlightGlobe: React.FC<InteractiveFlightGlobeProps> = ({
  origin,
  destination,
  progress,
  isFlightActive = false,
}) => {
  return (
    <RealisticEarthGlobe
      origin={origin}
      destination={destination}
      progress={progress}
      isFlightActive={isFlightActive}
    />
  );
};
