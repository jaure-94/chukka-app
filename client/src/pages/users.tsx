import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarNavigation, MobileNavigation } from "@/components/sidebar-navigation";
import { User, Mail, Phone, MapPin, Calendar, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserData {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: "active" | "inactive" | "pending";
  location: string;
  joinDate: string;
  avatar?: string;
}

const dummyUsers: UserData[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    phone: "+1 (555) 123-4567",
    role: "Operations Manager",
    department: "Operations",
    status: "active",
    location: "New York, NY",
    joinDate: "2023-01-15",
  },
  {
    id: 2,
    name: "Michael Chen",
    email: "michael.chen@company.com",
    phone: "+1 (555) 234-5678",
    role: "Tour Coordinator",
    department: "Tours",
    status: "active",
    location: "San Francisco, CA",
    joinDate: "2023-03-22",
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    email: "emily.rodriguez@company.com",
    phone: "+1 (555) 345-6789",
    role: "Customer Service Rep",
    department: "Customer Service",
    status: "active",
    location: "Miami, FL",
    joinDate: "2023-02-10",
  },
  {
    id: 4,
    name: "David Thompson",
    email: "david.thompson@company.com",
    phone: "+1 (555) 456-7890",
    role: "Finance Analyst",
    department: "Finance",
    status: "pending",
    location: "Chicago, IL",
    joinDate: "2024-01-05",
  },
  {
    id: 5,
    name: "Lisa Wang",
    email: "lisa.wang@company.com",
    phone: "+1 (555) 567-8901",
    role: "Marketing Specialist",
    department: "Marketing",
    status: "active",
    location: "Seattle, WA",
    joinDate: "2023-06-18",
  },
  {
    id: 6,
    name: "James Wilson",
    email: "james.wilson@company.com",
    phone: "+1 (555) 678-9012",
    role: "IT Support",
    department: "Technology",
    status: "active",
    location: "Austin, TX",
    joinDate: "2023-04-12",
  },
  {
    id: 7,
    name: "Maria Garcia",
    email: "maria.garcia@company.com",
    phone: "+1 (555) 789-0123",
    role: "HR Coordinator",
    department: "Human Resources",
    status: "active",
    location: "Los Angeles, CA",
    joinDate: "2023-05-30",
  },
  {
    id: 8,
    name: "Robert Lee",
    email: "robert.lee@company.com",
    phone: "+1 (555) 890-1234",
    role: "Sales Representative",
    department: "Sales",
    status: "inactive",
    location: "Denver, CO",
    joinDate: "2022-11-08",
  },
  {
    id: 9,
    name: "Jessica Brown",
    email: "jessica.brown@company.com",
    phone: "+1 (555) 901-2345",
    role: "Quality Assurance",
    department: "Operations",
    status: "active",
    location: "Phoenix, AZ",
    joinDate: "2023-07-25",
  },
  {
    id: 10,
    name: "Andrew Miller",
    email: "andrew.miller@company.com",
    phone: "+1 (555) 012-3456",
    role: "Data Analyst",
    department: "Analytics",
    status: "active",
    location: "Boston, MA",
    joinDate: "2023-08-14",
  },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "active":
      return "default";
    case "inactive":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "default";
  }
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

export default function Users() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SidebarNavigation />
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <MobileNavigation />
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Users</h1>
                  <p className="text-gray-600 mt-1">
                    Manage user accounts and permissions
                  </p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <User className="w-4 h-4 mr-2" />
                  Add New User
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-gray-900">8</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <User className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-bold text-gray-900">1</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <User className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Inactive</p>
                      <p className="text-2xl font-bold text-gray-900">1</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-gray-900">10</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dummyUsers.map((user) => (
                <Card key={user.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-gray-900">{user.name}</h3>
                          <p className="text-sm text-gray-500">{user.role}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>Edit User</DropdownMenuItem>
                          <DropdownMenuItem>Reset Password</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            Deactivate User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      <Badge variant={getStatusBadgeVariant(user.status)}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{user.phone}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{user.location}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span>Joined {new Date(user.joinDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Department</span>
                        <span className="text-sm font-medium text-gray-900">
                          {user.department}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}