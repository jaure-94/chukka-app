import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SHIP_NAMES, ShipName, DEFAULT_SHIP_NAMES } from '@/../../shared/ship-config';

export type ShipId = 'ship-a' | 'ship-b' | 'ship-c';

export interface ShipContextType {
  currentShip: ShipId | null;
  setCurrentShip: (shipId: ShipId) => void;
  getShipDisplayName: (shipId: ShipId) => string;
  selectedShipNames: Record<ShipId, ShipName>;
  setSelectedShipName: (shipId: ShipId, shipName: ShipName) => void;
  getSelectedShipName: (shipId: ShipId) => ShipName;
}

const ShipContext = createContext<ShipContextType | undefined>(undefined);

export const useShipContext = () => {
  const context = useContext(ShipContext);
  if (context === undefined) {
    throw new Error('useShipContext must be used within a ShipProvider');
  }
  return context;
};

interface ShipProviderProps {
  children: ReactNode;
}

export const ShipProvider: React.FC<ShipProviderProps> = ({ children }) => {
  // Initialize state from localStorage with fallback to ship-a
  const [currentShip, setCurrentShipState] = useState<ShipId | null>(() => {
    try {
      const stored = localStorage.getItem('selectedShip') as ShipId | null;
      return stored && ['ship-a', 'ship-b', 'ship-c'].includes(stored) ? stored : 'ship-a';
    } catch {
      return 'ship-a';
    }
  });

  // Initialize ship names from localStorage with defaults
  const [selectedShipNames, setSelectedShipNamesState] = useState<Record<ShipId, ShipName>>(() => {
    try {
      const stored = localStorage.getItem('selectedShipNames');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          'ship-a': parsed['ship-a'] || DEFAULT_SHIP_NAMES['ship-a'],
          'ship-b': parsed['ship-b'] || DEFAULT_SHIP_NAMES['ship-b'], 
          'ship-c': parsed['ship-c'] || DEFAULT_SHIP_NAMES['ship-c']
        };
      }
      return DEFAULT_SHIP_NAMES;
    } catch {
      return DEFAULT_SHIP_NAMES;
    }
  });

  const setCurrentShip = (shipId: ShipId) => {
    setCurrentShipState(shipId);
    try {
      localStorage.setItem('selectedShip', shipId);
    } catch (error) {
      console.warn('Failed to persist ship selection:', error);
    }
  };

  const setSelectedShipName = (shipId: ShipId, shipName: ShipName) => {
    const newShipNames = { ...selectedShipNames, [shipId]: shipName };
    setSelectedShipNamesState(newShipNames);
    try {
      localStorage.setItem('selectedShipNames', JSON.stringify(newShipNames));
    } catch (error) {
      console.warn('Failed to persist ship name selection:', error);
    }
  };

  const getSelectedShipName = (shipId: ShipId): ShipName => {
    return selectedShipNames[shipId];
  };

  const getShipDisplayName = (shipId: ShipId): string => {
    switch (shipId) {
      case 'ship-a':
        return 'SHIP A';
      case 'ship-b':
        return 'SHIP B';
      case 'ship-c':
        return 'SHIP C';
      default:
        return 'UNKNOWN SHIP';
    }
  };

  const contextValue: ShipContextType = {
    currentShip,
    setCurrentShip,
    getShipDisplayName,
    selectedShipNames,
    setSelectedShipName,
    getSelectedShipName,
  };

  return (
    <ShipContext.Provider value={contextValue}>
      {children}
    </ShipContext.Provider>
  );
};