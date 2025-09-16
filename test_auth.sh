#!/bin/bash

echo "=== Testing Authentication System ==="

# Test 1: Login as admin
echo "1. Login as admin..."
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin123!"}' \
  -c admin_cookies.txt

echo -e "\n\n2. Get current user info..."
curl -X GET http://localhost:5000/api/auth/me \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt

echo -e "\n\n3. Get all users (admin only)..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt

echo -e "\n\n4. Create supervisor user..."
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "username": "supervisor1",
    "password": "Password123!",
    "role": "supervisor",
    "position": "Fleet Supervisor",
    "employeeNumber": "SUP001",
    "email": "supervisor@company.com"
  }'

echo -e "\n\n5. Create regular user..."
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "username": "user1",
    "password": "Password123!",
    "role": "user",
    "position": "Data Entry Clerk",
    "employeeNumber": "USR001",
    "email": "user@company.com"
  }'

echo -e "\n\n6. Login as supervisor..."
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "supervisor1", "password": "Password123!"}' \
  -c supervisor_cookies.txt

echo -e "\n\n7. Try to access users as supervisor (should fail)..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b supervisor_cookies.txt

echo -e "\n\n8. Login as regular user..."
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "Password123!"}' \
  -c user_cookies.txt

echo -e "\n\n9. Try to access users as regular user (should fail)..."
curl -X GET http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -b user_cookies.txt

echo -e "\n\n10. Get user permissions as regular user..."
curl -X GET http://localhost:5000/api/users/profile/permissions \
  -H "Content-Type: application/json" \
  -b user_cookies.txt

echo -e "\n\n=== Test Complete ==="