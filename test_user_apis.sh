#!/bin/bash

# Comprehensive API Testing Script for User Management
echo "=== Maritime Dispatch System - User Management API Tests ==="
echo

# Clear any existing cookies
rm -f test_cookies.txt

echo "1. Testing Authentication (Login as admin)..."
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!"}' \
  -c test_cookies.txt \
  -s | jq '.'

echo -e "\n2. Testing GET /api/users (List all users - admin only)..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n3. Testing POST /api/users (Create new user - admin only)..."
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -d '{
    "firstName": "Sarah", 
    "lastName": "Johnson",
    "username": "sjohnson",
    "email": "sarah.johnson@company.com", 
    "password": "SecurePassword123!",
    "role": "supervisor",
    "position": "Operations Supervisor",
    "employeeNumber": "SUP001"
  }' \
  -s | jq '.'

echo -e "\n4. Testing POST /api/users (Create another user)..."
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -d '{
    "firstName": "Mike", 
    "lastName": "Wilson",
    "username": "mwilson",
    "email": "mike.wilson@company.com", 
    "password": "SecurePassword123!",
    "role": "user",
    "position": "Crew Member",
    "employeeNumber": "CREW001"
  }' \
  -s | jq '.'

echo -e "\n5. Testing GET /api/users/:id (Get specific user)..."
curl -X GET http://localhost:5000/api/users/2 \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n6. Testing PUT /api/users/:id (Update user information)..."
curl -X PUT http://localhost:5000/api/users/2 \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -d '{
    "firstName": "Sarah Elizabeth",
    "position": "Senior Operations Supervisor"
  }' \
  -s | jq '.'

echo -e "\n7. Testing POST /api/users/:id/deactivate (Deactivate user - admin only)..."
curl -X POST http://localhost:5000/api/users/3/deactivate \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n8. Testing POST /api/users/:id/activate (Reactivate user - admin only)..."
curl -X POST http://localhost:5000/api/users/3/activate \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n9. Testing GET /api/users/profile/permissions (Get current user permissions)..."
curl -X GET http://localhost:5000/api/users/profile/permissions \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n10. Testing validation: POST /api/users (Invalid data)..."
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -d '{
    "firstName": "A", 
    "lastName": "",
    "username": "xy",
    "email": "invalid-email", 
    "password": "123",
    "role": "manager"
  }' \
  -s | jq '.'

echo -e "\n11. Testing permission restriction: Login as regular user..."
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "mwilson", "password": "SecurePassword123!"}' \
  -c test_cookies_user.txt \
  -s | jq '.'

echo -e "\n12. Testing access control: Regular user trying to list all users (should fail)..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies_user.txt \
  -s | jq '.'

echo -e "\n13. Testing self-access: Regular user accessing own profile (should work)..."
curl -X GET http://localhost:5000/api/users/3 \
  -H "Content-Type: application/json" \
  -b test_cookies_user.txt \
  -s | jq '.'

echo -e "\n14. Final check: Get all users as admin..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b test_cookies.txt \
  -s | jq '.'

echo -e "\n=== API Testing Complete ==="

# Cleanup
rm -f test_cookies.txt test_cookies_user.txt