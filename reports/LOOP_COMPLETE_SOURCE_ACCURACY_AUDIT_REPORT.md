# LOOP: Complete Source-to-Website Data Accuracy Audit & Repair Report

**Execution Date:** 2026-10-23 13:37:17  
**Audited Stories:** 430  
**Branch Mismatches Identified:** 95  
**Name Mismatches Identified:** 2  
**Manual Review Records:** 31  

---

## 1. Executive Summary & Root Cause Analysis

### Root Cause of Systematic Branch Discrepancies
A thorough inspection of `extract_all_placement_years.py` and `extract_placement_stories.py` revealed that candidate branch extraction had two fundamental architectural flaws:

1. **Hardcoded Fallback to `CE`**: Line 659 defined `branch = 'CE'` as the initial default before scanning text.
2. **Omission of Core `CSE` in Regex Pattern**: The regex pattern `(EXTC|ETRX|CSE-AIML|CSE-DS|CSE AIML|CSE DS|Comps-[AB]|Computer Engineering|Information Technology|MCA)` explicitly omitted `\bCSE\b` and `\bComputer Science\b`. Consequently, any candidate who explicitly wrote `CSE` in their header (such as **Krishika Jalali**, **Apurva Khangal**, **Sahil Patil**, **Asim Shah**, **Vedant Tamboli**, and others) bypassed the regex match and silently inherited the default `branch = 'CE'`.
3. **Eligibility Confusion Prevention**: Per strict TPO guidelines, candidate department headers must never be overridden by `Eligibility Criteria: CE/CSE`. The candidate's personal degree track remains sovereign.

---

## 2. Complete Inventory of Confirmed Branch Mismatches & Proposed Corrections

| # | Candidate Name | Company | Passout Year | Stored DB Branch | Verified Source Branch | Source File | Status |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| 1 | **Apurva Khangal** | UBS | — | `CE` | **`CSE`** | `UBS_GOTOIntern_ApurvaKhangal.pdf` | Verified Source Mismatch |
| 2 | **Sahil Patil** | UBS | — | `CE` | **`CSE`** | `UBS_Graduate_Trainee_Sahil_Patil.pdf` | Verified Source Mismatch |
| 3 | **Jheel Parikh** | Oracle Financial Services (OFSS) | — | `CE` | **`CSE`** | `OFSS_ApplicationDev_JheelParikh.pdf` | Verified Source Mismatch |
| 4 | **Ruchi Bhanushali** | Barclays | — | `CE` | **`CSE-DS`** | `Barclays_SummerIntern_RuchiBhanushali.docx` | Verified Source Mismatch |
| 5 | **Asim Shah** | Barclays | — | `CE` | **`CSE`** | `Barclays_summer_intern_2025_ASIM.pdf` | Verified Source Mismatch |
| 6 | **Talha Naik** | PhonePe | — | `CE` | **`CSE-DS`** | `PhonePe_SDE_TalhaNaik.pdf` | Verified Source Mismatch |
| 7 | **Vedant Shah** | PhonePe | — | `CE` | **`CSE-DS`** | `PhonePe_SDE_VedantShah.pdf` | Verified Source Mismatch |
| 8 | **Shreshth Pradeep Singh** | BlackRock | — | `CE` | **`CSE-DS`** | `BlackRock_SDE_Shreshth_Pradeep_Singh.pdf` | Verified Source Mismatch |
| 9 | **Ninad Maadhavi** | WorkIndia | — | `CE` | **`CSE-AIML`** | `WorkIndia_SDE_NinadMaadhavi.pdf` | Verified Source Mismatch |
| 10 | **Paarth Dalvi** | ISS STOXX | — | `CE` | **`CSE-AIML`** | `ISS-STOXX_SDE_PaarthDalvi.pdf` | Verified Source Mismatch |
| 11 | **Yash Rawat** | ISS STOXX | — | `CE` | **`CSE-DS`** | `ISS-Stoxx_SDE_YashRawat.pdf` | Verified Source Mismatch |
| 12 | **Shrihari Joshi** | IDFC FIRST Bank | — | `CE` | **`CSE-AIML`** | `IDFC_ApplicationEngineer_ShrihariJoshi.pdf` | Verified Source Mismatch |
| 13 | **Yaddhnyesh Choudhari** | Baker Hughes | — | `CE` | **`CSE-DS`** | `BakerHughes_DTI_YaddhnyeshChoudhari.pdf` | Verified Source Mismatch |
| 14 | **Praveen Vishwakarma** | TransUnion | — | `CE` | **`CSE-AIML`** | `TransUnion_Dev-QE_PraveenVishwakarma.pdf` | Verified Source Mismatch |
| 15 | **Saurabh Gupta** | Barclays | — | `CE` | **`CSE-DS`** | `Barclays_TechnologyDeveloper_SaurabhGupta.pdf` | Verified Source Mismatch |
| 16 | **Tanvi Patil** | MSCI | — | `CE` | **`CSE-AIML`** | `MSCI_TechnologyIntern_TanviPatil.pdf` | Verified Source Mismatch |
| 17 | **Kunal Bhoi** | BrowserStack | — | `EXTC` | **`CSE-AIML`** | `BrowserStack_Kunal_Bhoi.pdf` | Verified Source Mismatch |
| 18 | **Yash Pabari** | Nomura | — | `CE` | **`IT`** | `Nomura_GDO_Yash_Pabari.docx` | Verified Source Mismatch |
| 19 | **Ounkar Jagtap** | IDfy | — | `CE` | **`IT`** | `IDfy_Software_Engineer-Labs_Ounkar_Jagtap.pdf` | Verified Source Mismatch |
| 20 | **Somil More** | Godrej Capital | — | `CE` | **`IT`** | `GodrejCapital_SDE_Somil.pdf` | Verified Source Mismatch |
| 21 | **Akshat Choradia** | Nomura | — | `CE` | **`IT`** | `AKSHAT_NOMURA_EXPERIENCE.pdf` | Verified Source Mismatch |
| 22 | **Ayush Singh** | PhonePe | — | `CE` | **`IT`** | `PhonePe_SDE_Intern_Ayush_Singh.pdf` | Verified Source Mismatch |
| 23 | **Aayush Sheth** | ISS STOXX | — | `CE` | **`IT`** | `Interview Experience.pdf` | Verified Source Mismatch |
| 24 | **Chirag Girdhar** | ISS STOXX | — | `CE` | **`CSE`** | `Junior_Analyst_ISS.pdf` | Verified Source Mismatch |
| 25 | **Keval Savla** | Oracle Financial Services (OFSS) | — | `CE` | **`IT`** | `Keval_Savla_Associate_Application_Developer_Oracle.pdf` | Verified Source Mismatch |
| 26 | **Prateek Redkar** | Oracle Financial Services (OFSS) | — | `CE` | **`IT`** | `Prateek_Redkar_Oracle_Interview Experience.pdf` | Verified Source Mismatch |
| 27 | **Harsh Patil** | Baker Hughes | — | `CE` | **`IT`** | `BakerHughes_HarshPatil.pdf` | Verified Source Mismatch |
| 28 | **Ayush Bhandarkar** | Deutsche Bank | — | `CE` | **`IT`** | `Interview Experience Ayush Bhandarkar.docx` | Verified Source Mismatch |
| 29 | **Satyasri Kaveri** | Deutsche Bank | — | `CE` | **`IT`** | `Kaveri_Deutsche Bank_Graduate Analyst.pdf` | Verified Source Mismatch |
| 30 | **Sumedha DB** | Deutsche Bank | — | `CE` | **`IT`** | `Sumedha_DB_InterviewExperience.pdf` | Verified Source Mismatch |
| 31 | **Janhvi Katkar** | J.P.Morgan Chase & Co. | — | `CE` | **`IT`** | `Interview Experience_Janhvi_CIB.pdf` | Verified Source Mismatch |
| 32 | **Adwait Nyayadhish** | MSCI | — | `CE` | **`IT`** | `MSCI_AdwaitNyayadhish.pdf` | Verified Source Mismatch |
| 33 | **Rupali Sawale** | KPMG | — | `CE` | **`CSE-DS`** | `KPMG_Rupali_DT_Analyst.pdf` | Verified Source Mismatch |
| 34 | **Vinay Prasad Jadhav** | KPMG | — | `CE` | **`CSE-AIML`** | `KPMG_Vinay_Interview_Experience.pdf` | Verified Source Mismatch |
| 35 | **Ankit Dighe** | IDFC FIRST Bank | — | `CE` | **`CSE-AIML`** | `IDFC_ApplicationEngineer_AnkitDighe.pdf` | Verified Source Mismatch |
| 36 | **Sridhar Sundar And** | Barclays | — | `CE` | **`EXTC`** | `Barclays_(SDE)_Sridhar_Sundar.pdf` | Verified Source Mismatch |
| 37 | **Manthan Satish Ayalwar** | Barclays | — | `CE` | **`CSE-DS`** | `Barclays_SDE_Manthan_Ayalwar.pdf` | Verified Source Mismatch |
| 38 | **Darshan Sanjay Jain** | PhonePe | — | `CE` | **`CSE-DS`** | `PhonePe_SDE_DarshanJain.pdf` | Verified Source Mismatch |
| 39 | **Satyam Jaiswal** | PhonePe | — | `CE` | **`CSE-AIML`** | `PhonePe_SDE_SatyamJaiswal.pdf` | Verified Source Mismatch |
| 40 | **Vanshika Shah** | PhonePe | — | `CE` | **`CSE-AIML`** | `PhonePe_SDE_Vanshika_Shah.pdf` | Verified Source Mismatch |
| 41 | **Vasundhara Singh** | Work India | — | `CE` | **`CSE-DS`** | `WorkIndia_DA_InterviewExp_Vasundhara_Singh.pdf` | Verified Source Mismatch |
| 42 | **Aditi Nilesh Bhutada** | WorkIndia | — | `CE` | **`CSE-DS`** | `WorkIndia_DataAnalyst_AditiBhutada.pdf` | Verified Source Mismatch |
| 43 | **Devam Gosalia** | Work India | — | `CE` | **`CSE-AIML`** | `WorkIndia_DataAnalyst_DevamGosalia.pdf` | Verified Source Mismatch |
| 44 | **Basuri Bhujade** | WorkIndia | — | `CE` | **`CSE`** | `WorkIndia_APM_BasuriBhujade.pdf` | Verified Source Mismatch |
| 45 | **Prathamesh Paradkar** | Oracle Financial Services (OFSS) | — | `CE` | **`CSE-AIML`** | `Oracle_Associate_Consultant_Prathamesh_Paradkar.pdf` | Verified Source Mismatch |
| 46 | **Advait Ravi Sapkal** | InCred Financial Services | — | `CE` | **`CSE-DS`** | `InCred_BusinessAnalyst_AdvaitSapkal.pdf` | Verified Source Mismatch |
| 47 | **Nathan Cardoso** | Omp India | — | `CE` | **`CSE-AIML`** | `OMP_AssociateConsultant_NathanCardoso.pdf` | Verified Source Mismatch |
| 48 | **Prithvi Singh** | Deloitte | — | `CE` | **`IT`** | `Deloitte_TechnologyAnalyst_Prithvi.pdf` | Verified Source Mismatch |
| 49 | **Aarya Patil** | ISS STOXX | — | `CE` | **`CSE-DS`** | `ISS_Analytical-Verification_Aarya.pdf` | Verified Source Mismatch |
| 50 | **Mohit Agarwal** | AuxoAI | — | `CE` | **`CSE-AIML`** | `AuxoAI_AIEngineer_MohitAgarwal.pdf` | Verified Source Mismatch |
| 51 | **AWANI KHODWE** | MSCI | — | `CE` | **`CSE-AIML`** | `MSCI_AwaniKhodwe_InterviewExperience.pdf` | Verified Source Mismatch |
| 52 | **Sarthak Gharat** | MSCI | — | `CE` | **`CSE-DS`** | `MSCI_TechnologyIntern_SarthakGharat.pdf` | Verified Source Mismatch |
| 53 | **Shreya Mahajan** | BNY Mellon | — | `CE` | **`CSE`** | `BNY_productionServices_Shreya_Mahajan (1).pdf` | Verified Source Mismatch |
| 54 | **Jeet Patel** | Revvity | — | `CE` | **`CSE`** | `Revvity_DataEngineer_JeetPatel_2027.pdf` | Verified Source Mismatch |
| 55 | **Ravitej Mulay** | Revvity | — | `CE` | **`CSE`** | `Revvity_Web_Intern_Ravitej_Sudhir_Mulay.docx` | Verified Source Mismatch |
| 56 | **Harsh Zaveri** | AuxoAI | — | `CE` | **`CSE`** | `AUXO_AI_Harsh_Zaveri.pdf` | Verified Source Mismatch |
| 57 | **Viraj Salunke** | AuxoAI | — | `CE` | **`CSE`** | `AUXO_AI_Viraj_Salunke.pdf` | Verified Source Mismatch |
| 58 | **Nitin Gawde** | AuxoAI | — | `CE` | **`CSE`** | `AuxoAI_Nitin_Gawde.pdf` | Verified Source Mismatch |
| 59 | **Chiranjan Sahu and** | UBS | — | `CE` | **`CSE`** | `ChiranjanSahu-Agentic AI specialist.docx` | Verified Source Mismatch |
| 60 | **Rehan Ansari** | UBS | — | `CE` | **`CSE`** | `Rehan Agentic AI Interview Experience.pdf` | Verified Source Mismatch |
| 61 | **Devesh Acharya** | UBS | — | `CE` | **`CSE`** | `UBS_GET_DeveshAcharya.pdf` | Verified Source Mismatch |
| 62 | **Lalita Dhavale** | UBS | — | `CE` | **`CSE`** | `UBS_GraduateTrainee_Lalita.pdf` | Verified Source Mismatch |
| 63 | **Harsh Mehta** | BlackRock | — | `CE` | **`CSE`** | `BlackRock_SDE_Harsh_Mehta.pdf` | Verified Source Mismatch |
| 64 | **Hritani Dinda** | BlackRock | — | `CE` | **`CSE`** | `BlackRock_SDE_HritaniDinda.pdf` | Verified Source Mismatch |
| 65 | **Shiven Shukla** | WorkIndia | — | `CE` | **`CSE`** | `WorkIndia_SDE_ShivenShukla.pdf` | Verified Source Mismatch |
| 66 | **Soham Padalia** | PhonePe | — | `CE` | **`CSE`** | `PhonePe_SDE_SohamPadalia_2027.pdf` | Verified Source Mismatch |
| 67 | **Parth Gujarkar** | Barclays | — | `CE` | **`CSE`** | `Barclays_Summer_Intern_Parth_Gujarkar.pdf` | Verified Source Mismatch |
| 68 | **Raj Vardhan Singh** | Barclays | — | `CE` | **`CSE`** | `Barclays_Summer_Intern_Raj Vardhan_Singh.pdf` | Verified Source Mismatch |
| 69 | **Siddh Jain** | Barclays | — | `CE` | **`CSE`** | `Barclays_Summer_Intern_Siddh_Jain.pdf` | Verified Source Mismatch |
| 70 | **Rayyan Ahmed Siddiqui** | Barclays | — | `CE` | **`CSE`** | `Barclays_Summer_Internship_Rayyan_Siddiqui.pdf` | Verified Source Mismatch |
| 71 | **Devanshi Gupta** | J.P. Morgan | — | `CE` | **`CSE`** | `Devanshi Gupta JPMC CR.pdf` | Verified Source Mismatch |
| 72 | **Harsh Malpani** | J.P. Morgan | — | `CE` | **`CSE`** | `Harsh Malpani JPMC CR.pdf` | Verified Source Mismatch |
| 73 | **Mantasha Mohammed Sadiq** | J.P. Morgan | — | `CE` | **`CSE`** | `JPMC_CR_Mantasha_Sadiq.pdf` | Verified Source Mismatch |
| 74 | **Nandini Parab** | Jpmorgan Chase & Co | — | `CE` | **`CSE`** | `JPMC_CR_Nandini_Parab.pdf` | Verified Source Mismatch |
| 75 | **Prachi Barhate** | J.P. Morgan | — | `CE` | **`CSE`** | `JPMC_CR_PrachiBarhate.pdf` | Verified Source Mismatch |
| 76 | **Mithilesh Deshmukh** | J.P. Morgan | — | `CE` | **`CSE`** | `Mithilesh Deshmukh JPMC CR.pdf` | Verified Source Mismatch |
| 77 | **Priyank Shah** | Jpmorgan Chase & Co | — | `CE` | **`CSE`** | `Priyank_Shah_JPMC_CR (1).pdf` | Verified Source Mismatch |
| 78 | **Reetika Gupta** | J.P. Morgan | — | `CE` | **`CSE`** | `JPMC_CTC_Risk_ReetikaGupta.pdf` | Verified Source Mismatch |
| 79 | **Yug Bhanushali** | J.P. Morgan | — | `CE` | **`CSE`** | `Yug_Bhanushali_CTC_Risk.pdf` | Verified Source Mismatch |
| 80 | **Siddarth Potdar** | Jpmorgan Chase & Co | — | `CE` | **`CSE`** | `JPMC_CIB_Siddarth_Potdar.pdf` | Verified Source Mismatch |
| 81 | **Madhura Lolayekar** | J.P. Morgan | — | `CE` | **`CSE`** | `Madhura Lolayekar(JPMC-CIB).pdf` | Verified Source Mismatch |
| 82 | **Vishal Raina** | J.P. Morgan | — | `CE` | **`CSE`** | `JPMC_Fintech_VishalRaina.pdf` | Verified Source Mismatch |
| 83 | **Krishika Jalali** | IDFC FIRST Bank | — | `CE` | **`CSE`** | `IDFC_ApplicationEngineer_KrishikaJalali.pdf` | Verified Source Mismatch |
| 84 | **Swayam Kelkar** | IDFC FIRST Bank | — | `CE` | **`CSE`** | `IDFC_ApplicationEngineer_SwayamKelkar.pdf` | Verified Source Mismatch |
| 85 | **Vedant Tamboli** | IDFC FIRST Bank | — | `EXTC` | **`CSE`** | `IDFC_Application_Engineer_Vedant.pdf` | Verified Source Mismatch |
| 86 | **Suraj Nair** | ISS STOXX | — | `CE` | **`CSE`** | `ISS-STOXX_SDE_SurajNair.pdf` | Verified Source Mismatch |
| 87 | **Arushi Jain** | ISS STOXX | — | `CE` | **`CSE`** | `ISS-Stoxx_SDE_ArushiJain.pdf` | Verified Source Mismatch |
| 88 | **Advait Satpute** | Nomura | — | `CE` | **`CSE`** | `Nomura_KakushIN_AdvaitSatpute.pdf` | Verified Source Mismatch |
| 89 | **Kshitij Aggarwal** | Nomura | — | `CE` | **`CSE`** | `Nomura_KakushIN_KshitijAggarwal.pdf` | Verified Source Mismatch |
| 90 | **Aaryan Urunkar** | Russell Investments | — | `CE` | **`CSE`** | `Russel_Investments_Tech_Intern_Aaryan_Urunkar.pdf` | Verified Source Mismatch |
| 91 | **Rachel Fernandes** | TransUnion | — | `CE` | **`CSE`** | `TransUnion_Rachel.pdf` | Verified Source Mismatch |
| 92 | **Nitin Sharma** | Capgemini | — | `CE` | **`CSE`** | `Capgemini_AlphaStack_NitinSharma.pdf` | Verified Source Mismatch |
| 93 | **Somanshu Mahajan** | Capgemini | — | `CE` | **`CSE`** | `Somanshu_Mahajan_Capgemini.pdf` | Verified Source Mismatch |
| 94 | **Vatsal Jain** | Capgemini | — | `CE` | **`CSE`** | `Vatsal_Jain_Capgemini.pdf` | Verified Source Mismatch |
| 95 | **Mayur Raonang** | ISS STOXX | — | `CE` | **`CSE`** | `Wissen_SDE_MayurRaonang.pdf` | Verified Source Mismatch |

---

## 3. Candidate Name Mismatches Corrected

| Story ID | Stored DB Name | Corrected Source Name | Source File |
| :--- | :--- | :--- | :--- |
| `story_2026_65225111` | `Jash Shah` | **`Jsh Kapil Agarwal`** | `InCred_BuisnessAnalyst_Jsh.pdf` |
| `story_2027_b66cc323` | `BHAVIK DESAI wwwlinkedincominbhavikdesaiib` | **`BHAVIK DESAI`** | `JPMC_CIB_BHAVIK_DESAI.pdf` |

---

## 4. Records Requiring Manual Review (Branch Not Explicitly Stated in Source)

| Story ID | Candidate Name | Company | Passout Year | Reason |
| :--- | :--- | :--- | :---: | :--- |
| `story_2026_34230372` | **Dhruv Deshpande** | AuxoAI | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_10137144` | **Prashant Tiwari** | Oracle Financial Services (OFSS) | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_68003868` | **Heet Shah** | UBS | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_35118136` | **Atharva Dahegaonkar** | J.P. Morgan | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_61964266` | **Rashi Lodha** | ISS STOXX | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_65225111` | **Jash Shah** | InCred Financial Services | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_26830791` | **Shubham Karampure** | MSCI | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_96769153` | **Parnika Das** | KPMG | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_32573396` | **Aniket Paraswar** | BrowserStack | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_55740071` | **Shardul Mahindrakar** | Nomura | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_2903ffd0` | **Muskan Sharma** | General Mills | 2026 | Candidate branch not explicitly stated in header |
| `story_2026_9980d9b1` | **Soham Karmarkar** | Nomura | 2026 | Candidate branch not explicitly stated in header |
| `story_2024_e0d534fc` | **Manushree Dubey** | ISS STOXX | 2024 | Candidate branch not explicitly stated in header |
| `story_2024_a3ff7c11` | **Shashank JagtapEXTC** | Baker Hughes | 2024 | Candidate branch not explicitly stated in header |
| `story_2024_d2517f37` | **Prathamesh Pawar** | Deutsche Bank | 2024 | Candidate branch not explicitly stated in header |
| `story_2024_54b860d1` | **Shrutiman** | Deutsche Bank | 2024 | Candidate branch not explicitly stated in header |
| `story_2024_77f10725` | **Narayan Dhayaba Gawas** | Deutsche Bank | 2024 | Candidate branch not explicitly stated in header |
| `story_2024_200b5a0a` | **Srushti Gavand** | Indus Towers | 2024 | Candidate branch not explicitly stated in header |
| `story_2025_684b3728` | **Anish Gade** | IDFC FIRST Bank | 2025 | Candidate branch not explicitly stated in header |
| `story_2025_2016ffc9` | **Kunal Virendra Bhatia** | Equity Data Science (EDS) | 2025 | Candidate branch not explicitly stated in header |
| `story_2025_7ec35412` | **Bhavesh Chaudhari CS** | Barclays | 2025 | Candidate branch not explicitly stated in header |
| `story_2025_048b444f` | **MDA Training Joseph Pereira** | Mdatraining | 2025 | Candidate branch not explicitly stated in header |
| `story_2025_a8f087a8` | **Shaan Agarwal** | Nomura | 2025 | Candidate branch not explicitly stated in header |
| `story_2025_0120e525` | **Palaash Jain** | Arcon | 2025 | Candidate branch not explicitly stated in header |
| `story_2027_c0206428` | **Dev Rai** | AuxoAI | 2027 | Candidate branch not explicitly stated in header |
| `story_2027_6ce938ec` | **Daksh Jain** | PhonePe | 2027 | Candidate branch not explicitly stated in header |
| `story_2027_7cc25515` | **Daksh Chetan Jain** | PhonePe | 2027 | Candidate branch not explicitly stated in header |
| `story_2027_bf0cd746` | **Raj Kalpesh Mathuria** | Barclays | 2027 | Candidate branch not explicitly stated in header |
| `story_2027_4f4008e3` | **Heet Keyur Shah** | Barclays | 2027 | Candidate branch not explicitly stated in header |
| `story_2027_d1bb7dd4` | **Dhruv Mukesh Tiwari and** | ISS STOXX | 2027 | Candidate branch not explicitly stated in header |
