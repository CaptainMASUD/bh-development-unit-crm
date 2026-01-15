import React from "react";
import { Outlet } from "react-router-dom";
import ThemeProvider from "../ThemeProvider/ThemeProvider";
import SoftwareUpdateModal from "../SoftwareUpdateModal/SoftwareUpdateModal";

export default function Layout() {
  return (
    <ThemeProvider>
      <Outlet />
     
    </ThemeProvider>
  );
}
