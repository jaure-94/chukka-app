import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock } from "lucide-react";

interface EnhancedDatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  error?: string;
}

export function EnhancedDatePicker({ label, value, onChange, id, error }: EnhancedDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Parse existing datetime-local value
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        setSelectedYear(String(year));
        setSelectedMonth(month);
        setSelectedDay(day);
        setSelectedTime(`${hours}:${minutes}`);
        setSelectedDate(`${year}-${month}-${day}`);
      }
    }
  }, [value]);

  // Generate options for dropdowns
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  // Get days for selected month/year
  const getDaysInMonth = (month: string, year: string) => {
    if (!month || !year) return 31;
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

  // Handle dropdown changes
  const handleDateChange = (type: string, newValue: string) => {
    let newDay = selectedDay;
    let newMonth = selectedMonth;
    let newYear = selectedYear;

    switch (type) {
      case 'year':
        newYear = newValue;
        setSelectedYear(newValue);
        break;
      case 'month':
        newMonth = newValue;
        setSelectedMonth(newValue);
        // Adjust day if it exceeds days in new month
        const maxDays = getDaysInMonth(newValue, newYear);
        if (parseInt(selectedDay) > maxDays) {
          newDay = String(maxDays).padStart(2, '0');
          setSelectedDay(newDay);
        }
        break;
      case 'day':
        newDay = newValue;
        setSelectedDay(newValue);
        break;
    }

    // Update the date string and call onChange
    if (newYear && newMonth && newDay) {
      const newDateString = `${newYear}-${newMonth}-${newDay}`;
      setSelectedDate(newDateString);
      
      if (selectedTime) {
        onChange(`${newDateString}T${selectedTime}`);
      } else {
        onChange(`${newDateString}T00:00`);
      }
    }
  };

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    if (selectedDate) {
      onChange(`${selectedDate}T${newTime}`);
    }
  };

  const handleDirectDateChange = (newValue: string) => {
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <CalendarDays className="w-4 h-4" />
        {label}
      </Label>
      
      {/* Quick Date Selection Dropdowns */}
      <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200 space-y-3">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Quick Date Selection</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Year</Label>
            <Select value={selectedYear} onValueChange={(value) => handleDateChange('year', value)}>
              <SelectTrigger className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Month</Label>
            <Select value={selectedMonth} onValueChange={(value) => handleDateChange('month', value)}>
              <SelectTrigger className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Day</Label>
            <Select value={selectedDay} onValueChange={(value) => handleDateChange('day', value)}>
              <SelectTrigger className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Time Selection */}
      <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 space-y-2">
        <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Time Selection
        </Label>
        <Input
          type="time"
          value={selectedTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-full rounded-lg border-blue-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Traditional Date-Time Picker (Fallback) */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
        <Label className="text-xs text-gray-500 mb-2 block">Or use traditional picker:</Label>
        <Input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => handleDirectDateChange(e.target.value)}
          className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
          {error}
        </p>
      )}
    </div>
  );
}