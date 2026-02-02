// app.js
import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: ["https://businesshub-crm.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

import userRoutes from "./routes/user.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import customerRoutes from "./routes/customer.route.js";
import taskRoutes from "./routes/task.route.js";
import reportRoutes from "./routes/report.route.js";
import leadRoutes from "./routes/lead.routes.js";
import taskTemplateRoutes from "./routes/taskTemplate.route.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import engagementTemplateRoutes from "./routes/engagementTemplate.route.js";
import workloadRoutes from "./routes/workload.route.js";
import activityRoutes from "./routes/activity.routes.js";
import viewPreferenceRoutes from "./routes/viewPreference.routes.js";
import purchaseTypeRoutes from "./routes/purchaseType.routes.js";

app.use("/api/activity", activityRoutes);


app.use("/api/workload", workloadRoutes);

// dashboard
app.use("/api/dashboard", dashboardRoutes);


  
// templates
app.use("/api", taskTemplateRoutes);
app.use("/api/engagement-templates", engagementTemplateRoutes); 

// core modules
app.use("/api/leads", leadRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api", taskRoutes);
app.use("/api", reportRoutes);

app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);

app.use("/api/view-preferences", viewPreferenceRoutes);
app.use("/api/purchase-types", purchaseTypeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

export { app };
