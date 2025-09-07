import React from 'react';
import { useShipContext, type ShipId } from '@/contexts/ship-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Ship } from 'lucide-react';
import { useLocation } from 'wouter';
import { SHIP_NAMES, type ShipName } from '@/../../shared/ship-config';

interface ShipSelectorProps {
  showLabel?: boolean;
  className?: string;
  showShipNameDropdown?: boolean;
}

export const ShipSelector: React.FC<ShipSelectorProps> = ({ 
  showLabel = true, 
  className = "",
  showShipNameDropdown = false 
}) => {
  const { currentShip, setCurrentShip, getShipDisplayName, getSelectedShipName, setSelectedShipName } = useShipContext();
  const [location, setLocation] = useLocation();

  const handleShipChange = (value: string) => {
    setCurrentShip(value as ShipId);
    
    // Navigate to the ship-specific page if we're currently on a ship-aware route
    if (location.includes('/reports/')) {
      setLocation(`/reports/${value}`);
    } else if (location.includes('/create-dispatch/')) {
      setLocation(`/create-dispatch/${value}`);
    } else if (location.includes('/templates/')) {
      setLocation(`/templates/${value}`);
    } else if (location === '/reports') {
      setLocation(`/reports/${value}`);
    } else if (location === '/create-dispatch') {
      setLocation(`/create-dispatch/${value}`);
    } else if (location === '/templates') {
      setLocation(`/templates/${value}`);
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Ship className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          {showLabel && (
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Select Ship
            </label>
          )}
          <div className="space-y-3">
            <Select value={currentShip || ''} onValueChange={handleShipChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a ship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ship-a">{getShipDisplayName('ship-a')}</SelectItem>
                <SelectItem value="ship-b">{getShipDisplayName('ship-b')}</SelectItem>
                <SelectItem value="ship-c">{getShipDisplayName('ship-c')}</SelectItem>
              </SelectContent>
            </Select>
            
            {showShipNameDropdown && currentShip && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Ship Name
                </label>
                <Select 
                  value={getSelectedShipName(currentShip)} 
                  onValueChange={(value: ShipName) => setSelectedShipName(currentShip, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose ship name" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIP_NAMES.map((shipName) => (
                      <SelectItem key={shipName} value={shipName}>{shipName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>
      {currentShip && (
        <div className="mt-3 text-sm text-gray-600">
          Currently managing: <span className="font-semibold text-blue-600">
            {getShipDisplayName(currentShip)}
          </span>
          {showShipNameDropdown && (
            <span className="block text-xs text-gray-500 mt-1">
              Ship Name: <span className="font-medium text-gray-700">{getSelectedShipName(currentShip)}</span>
            </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default ShipSelector;