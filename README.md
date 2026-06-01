# Grant Management and Project Tracking System

A secure, web-based management system designed to streamline academic grant allocations, budget monitoring, and institutional project tracking. 

## 🛡️ Backend Architecture & Database Security
The core focus of this repository is a highly secure, relational data layer built using **SQL** and **Supabase**, engineered to prevent data anomalies and secure sensitive financial transactions.

### Key Technical Implementations
* **Row-Level Security (RLS):** Configured strict, database-level isolation policies to ensure users can only view or modify records explicitly matching their authorized institutional roles.
* **Advanced Data Integrity:** Implemented structured relational tables coupled with strict `CHECK` constraints to eliminate mathematical errors and safeguard budget metrics.
* **Automated Audit Logging:** Designed dedicated historical tracking schemas that systematically log data modifications, providing full structural accountability for budget changes.
* **Schema Auditing:** Conducted iterative technical reviews and normalisation audits to optimise structural query performance and backend stability.

## 🛠️ Technology Stack & Tools
* **Database Engine:** PostgreSQL (via Supabase)
* **Environment:** Visual Studio Code (VS Code)
* **Architecture Modeling:** Relational Database Schema Design
