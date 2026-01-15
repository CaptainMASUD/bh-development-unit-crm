import React from "react";
import { FaSearch, FaToolbox, FaUserCircle } from "react-icons/fa";
import { Button } from "flowbite-react";

const QAEngineersWebsite = () => {
  return (
    <div className="font-sans">
      {/* Header and Navigation */}
      <header className="bg-blue-800 text-white p-6">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold">QA Engineers Hub</h1>
          <nav className="space-x-6">
            <a href="#home" className="hover:text-gray-300">Home</a>
            <a href="#resources" className="hover:text-gray-300">Resources</a>
            <a href="#tools" className="hover:text-gray-300">Tools</a>
            <a href="#jobs" className="hover:text-gray-300">Jobs</a>
            <a href="#community" className="hover:text-gray-300">Forum</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-blue-900 text-white text-center py-20">
        <h2 className="text-4xl font-bold mb-4">Empowering QA Engineers for Excellence</h2>
        <p className="text-xl mb-8">Tools, resources, and collaboration for software testing professionals.</p>
        <Button color="success" className="px-8 py-3 text-lg">Explore Resources</Button>
      </section>

      {/* Resources Section */}
      <section id="resources" className="py-16 px-6">
        <h3 className="text-3xl font-bold text-center mb-6">QA Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h4 className="text-xl font-semibold">Test Automation</h4>
            <p className="text-gray-600">Learn about the best automation frameworks and how to use them effectively.</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <h4 className="text-xl font-semibold">Manual Testing</h4>
            <p className="text-gray-600">Explore the fundamentals of manual testing and real-world applications.</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <h4 className="text-xl font-semibold">Bug Reporting</h4>
            <p className="text-gray-600">A guide on writing clear bug reports and best practices for communication.</p>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="bg-gray-100 py-16 px-6">
        <h3 className="text-3xl font-bold text-center mb-6">QA Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <FaToolbox className="text-4xl text-blue-600 mb-4" />
            <h4 className="text-xl font-semibold">Selenium</h4>
            <p className="text-gray-600">Automated testing for web applications using Selenium WebDriver.</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <FaToolbox className="text-4xl text-blue-600 mb-4" />
            <h4 className="text-xl font-semibold">JIRA</h4>
            <p className="text-gray-600">Project management and issue tracking tool for QA teams.</p>
          </div>
          <div className="bg-white shadow-md rounded-lg p-6">
            <FaToolbox className="text-4xl text-blue-600 mb-4" />
            <h4 className="text-xl font-semibold">Postman</h4>
            <p className="text-gray-600">API testing made simple with Postman for developers and testers.</p>
          </div>
        </div>
      </section>

      {/* Job Opportunities Section */}
      <section id="jobs" className="py-16 px-6 bg-white">
        <h3 className="text-3xl font-bold text-center mb-6">Job Opportunities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold">QA Engineer</h4>
            <p className="text-gray-600">Looking for a QA engineer with 3+ years of experience in test automation.</p>
            <Button className="bg-blue-600 text-white mt-4">Apply Now</Button>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold">QA Tester</h4>
            <p className="text-gray-600">Seeking a manual QA tester for an enterprise application.</p>
            <Button className="bg-blue-600 text-white mt-4">Apply Now</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-800 text-white py-6">
        <div className="container mx-auto text-center">
          <p>&copy; 2025 QA Engineers Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default QAEngineersWebsite;
