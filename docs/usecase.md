# FixNow - Module & Use Case List

## Module 1. Authentication & Account

### Customer / Provider / Admin

1. Register Account
2. Verify Email
3. Login with Email
4. Login with Google
5. Login with Facebook
6. Logout
7. Forgot Password
8. Reset Password
9. Change Password
10. View Profile
11. Update Profile
12. Upload Avatar
13. Lock Account
14. Unlock Account
15. Suspend Account

---

## Module 2. Address Management

### Customer

16. Add Address
17. Update Address
18. Delete Address
19. Set Default Address
20. View Address List

---

## Module 3. Provider Registration

### Provider

21. Register as Provider
22. Upload ID Card
23. Upload Professional Certificate
24. View Application Status
25. Update Application Information

### Admin

26. View Provider Applications
27. Approve Provider
28. Reject Provider
29. Request Additional Documents

---

## Module 4. Provider Operation

### Provider

30. Go Online
31. Go Offline
32. Enable Receiving Jobs
33. Disable Receiving Jobs
34. Select Working Areas
35. Update Working Areas
36. Register Supported Services
37. Enable / Disable Service Types
38. View Reviews
39. View Reputation Score
40. View Order History

### Admin

41. Suspend Provider
42. Record Provider Violations
43. Reduce Reputation Score

---

## Module 5. Service Category Management

### Admin

44. Create Service Category
45. Update Service Category
46. Disable Service Category
47. Create Service
48. Update Service
49. Delete Service
50. Configure Fixed Price
51. Configure Deposit Amount
52. Configure Platform Fee
53. Configure Warranty Policy

### Example Category Structure

```
Air Conditioner
├── Cleaning
│   ├── Wall Mounted
│   ├── Ceiling Cassette
│   └── Standing Unit
├── Installation
└── Repair
```

---

## Module 6. Booking / Order

### Customer

54. Create Service Request
55. Select Address
56. Select Service
57. Select Service Type
58. Describe Issue
59. Upload Images
60. Upload Videos
61. Schedule Future Booking
62. Pay Deposit
63. View Order Status
64. View Order Detail
65. Cancel Order Before Provider Accepts
66. View Order History

---

## Module 7. Provider Matching

### System

67. Find Nearby Providers
68. Filter Providers by Area
69. Filter Online Providers
70. Filter Providers by Service Capability
71. Calculate Matching Priority Score
72. Send Request to Provider
73. Provider Timeout After 30 Seconds
74. Reassign to Next Provider
75. Stop After 5 Rejections
76. Mark No Provider Found
77. Save Matching History

### Provider

78. Accept Request
79. Reject Request

---

## Module 8. Service Execution

### Provider

80. View Assigned Order
81. View Customer Information
82. Start Navigation
83. Mark Arrived
84. Start Working
85. Upload Progress Photos
86. Upload Completion Photos
87. Complete Order

### Customer

88. View Order Progress

---

## Module 9. Quotation Management

### Provider

89. Create Quotation
90. Describe Detected Issue
91. Upload Issue Evidence
92. Add Labor Fee
93. Add Material Cost
94. Submit Quotation

### Customer

95. View Quotation
96. Accept Quotation
97. Reject Quotation

### System

98. Save Quotation History
99. Lock Accepted Quotation

---

## Module 10. Payment & Wallet

### Customer

100. Pay Deposit via PayOS
101. Pay Remaining Amount Online
102. Pay by Cash

### Provider

103. Confirm Cash Received
104. View Wallet Balance
105. View Platform Debt
106. Pay Platform Debt
107. Add Bank Account
108. Request Withdrawal
109. View Transaction History

### Admin

110. Approve Withdrawal
111. Reject Withdrawal

### System

112. Calculate Platform Fee
113. Calculate Provider Earnings
114. Record Transactions
115. Lock Provider for Unpaid Debt

---

## Module 11. Review & Rating

### Customer

116. Rate Provider
117. Write Review
118. Upload Review Images

### Provider

119. View Reviews
120. Reply to Reviews

### System

121. Update Rating Score
122. Update Reputation Score

---

## Module 12. Complaint & Warranty

### Customer

123. Submit Complaint
124. Request Warranty
125. Upload Evidence

### Provider

126. Respond to Complaint
127. Handle Warranty Request

### Admin

128. Receive Complaint
129. Process Complaint
130. Decide Compensation
131. Record Provider Violations

---

## Module 13. Chat & Notification

### Customer / Provider

132. Send Message
133. Send Image
134. Send Video
135. View Chat History

### System

136. New Order Notification
137. Provider Accepted Notification
138. Quotation Notification
139. Payment Notification
140. Email Notification
141. Mark Notification as Read

---

## Module 14. Promotion

### Admin

142. Create Promotion Code
143. Update Promotion Code
144. Disable Promotion Code

### Customer

145. Apply Promotion Code

### System

146. Validate Promotion Conditions

---

## Module 15. Admin Dashboard

### Admin

147. View Dashboard
148. View Total Users
149. View Total Providers
150. View Total Orders
151. View Revenue
152. View Total Deposits
153. View Provider Debts
154. View Top Providers
155. Manage Users
156. Manage Providers
157. Manage Services
158. Manage Orders
159. Manage Payments
160. Manage Complaints
161. Manage Promotions
162. View Audit Logs

---

## Summary

* Total Modules: 15
* Total Use Cases: 162
* Main Roles:

  * Customer
  * Provider
  * Admin
  * System

Core Business Flow:

Customer → Booking → Matching → Provider Accept → Service Execution → Payment → Review → Complaint/Warranty
