

from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


MODEL_PATH = Path(__file__).parent / "random_forest_placement_model_ct_pipeline.joblib"

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model file not found at {MODEL_PATH}. "
        "Place random_forest_placement_model_ct_pipeline.joblib next to main.py."
    )

model = joblib.load(MODEL_PATH)

FEATURE_ORDER = [
    "Age", "Gender", "Degree", "Branch", "CGPA", "10th_Percentage",
    "12th_Percentage", "Attendance_Percentage", "Active_Backlogs",
    "Programming_Score", "Aptitude_Score", "Communication_Score",
    "Technical_Interview_Score", "Mock_Interview_Score", "Internships",
    "Projects", "Hackathons", "Certifications", "Problem_Solving",
    "English_Fluency",
]

GENDER_VALUES = ["Female", "Male"]
DEGREE_VALUES = ["B.Tech", "BBA", "BCA", "MBA", "MCA"]
BRANCH_VALUES = [
    "Agriculture", "Aircraft and Maintenance", "BBA", "BCA", "CSE",
    "CSE-AIML", "CSE-CyberSecurity", "CSE-DS", "Civil", "ECE",
    "ECE-VLSI", "EEE", "MBA", "MCA", "Mechanical",
]



class StudentFeatures(BaseModel):
    Age: int = Field(..., ge=17, le=40, examples=[21])
    Gender: Literal["Female", "Male"]
    Degree: Literal["B.Tech", "BBA", "BCA", "MBA", "MCA"]
    Branch: Literal[
        "Agriculture", "Aircraft and Maintenance", "BBA", "BCA", "CSE",
        "CSE-AIML", "CSE-CyberSecurity", "CSE-DS", "Civil", "ECE",
        "ECE-VLSI", "EEE", "MBA", "MCA", "Mechanical",
    ]
    CGPA: float = Field(..., ge=0, le=10, examples=[8.2])
    the_10th_Percentage: float = Field(..., ge=0, le=100, alias="10th_Percentage", examples=[85.0])
    the_12th_Percentage: float = Field(..., ge=0, le=100, alias="12th_Percentage", examples=[82.0])
    Attendance_Percentage: float = Field(..., ge=0, le=100, examples=[90.0])
    Active_Backlogs: int = Field(..., ge=0, examples=[0])
    Programming_Score: float = Field(..., ge=1, le=10, examples=[7])
    Aptitude_Score: float = Field(..., ge=1, le=10, examples=[6])
    Communication_Score: float = Field(..., ge=1, le=10, examples=[6])
    Technical_Interview_Score: float = Field(..., ge=1, le=10, examples=[7])
    Mock_Interview_Score: float = Field(..., ge=1, le=10, examples=[7])
    Internships: int = Field(..., ge=0, examples=[1])
    Projects: int = Field(..., ge=0, examples=[3])
    Hackathons: int = Field(..., ge=0, examples=[1])
    Certifications: int = Field(..., ge=0, examples=[2])
    Problem_Solving: float = Field(..., ge=1, le=10, examples=[7])
    English_Fluency: float = Field(..., ge=1, le=10, examples=[7])

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "Age": 21,
                "Gender": "Male",
                "Degree": "B.Tech",
                "Branch": "CSE",
                "CGPA": 8.2,
                "10th_Percentage": 85.0,
                "12th_Percentage": 82.0,
                "Attendance_Percentage": 90.0,
                "Active_Backlogs": 0,
                "Programming_Score": 7,
                "Aptitude_Score": 6,
                "Communication_Score": 6,
                "Technical_Interview_Score": 7,
                "Mock_Interview_Score": 7,
                "Internships": 1,
                "Projects": 3,
                "Hackathons": 1,
                "Certifications": 2,
                "Problem_Solving": 7,
                "English_Fluency": 7,
            }
        }


class PredictionResponse(BaseModel):
    placed: bool
    prediction: int
    probability_placed: float
    probability_not_placed: float



app = FastAPI(
    title="Placement Prediction API",
    description="Serves predictions from a Random Forest placement model.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(student: StudentFeatures):
    try:
        payload = student.model_dump(by_alias=True)
        row = pd.DataFrame([[payload[col] for col in FEATURE_ORDER]], columns=FEATURE_ORDER)

        pred = model.predict(row)[0]
        proba = model.predict_proba(row)[0]  

        return PredictionResponse(
            placed=bool(pred == 1),
            prediction=int(pred),
            probability_not_placed=float(proba[0]),
            probability_placed=float(proba[1]),
        )
    except Exception as exc:  
        raise HTTPException(status_code=400, detail=f"Prediction failed: {exc}") from exc