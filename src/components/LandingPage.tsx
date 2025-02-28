import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Rocket, Zap, Globe, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-32 text-center">
        <h1 className="text-6xl font-extrabold text-white mb-6 tracking-tight">
          Revolutionizing
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            {" "}
            Mobility{" "}
          </span>
          Through AI
        </h1>
        <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
          Leveraging cutting-edge artificial intelligence to create the future
          of transportation. 10x better. 100x faster. Infinitely scalable.
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex gap-4">
            <Button
              size="lg"
              className="bg-white text-indigo-600 hover:bg-white/90"
              onClick={() => navigate("/signup")}
            >
              Sign Up <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-white border-white hover:bg-white/10"
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          </div>
          <Button
            size="lg"
            variant="outline"
            className="text-white border-white hover:bg-white/10"
          >
            Watch Demo
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white/10 backdrop-blur-lg py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { number: "$50M+", label: "Venture Backed" },
              { number: "100K+", label: "Active Users" },
              { number: "28", label: "Cities Live" },
            ].map((stat) => (
              <div key={stat.label} className="text-center text-white">
                <div className="text-4xl font-bold mb-2">{stat.number}</div>
                <div className="text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: <Rocket className="h-8 w-8" />,
              title: "10x Growth",
              description:
                "Exponential user acquisition through network effects",
            },
            {
              icon: <Zap className="h-8 w-8" />,
              title: "AI-Powered",
              description:
                "Advanced algorithms for perfect matching every time",
            },
            {
              icon: <Globe className="h-8 w-8" />,
              title: "Global Scale",
              description: "Built for worldwide deployment from day one",
            },
            {
              icon: <TrendingUp className="h-8 w-8" />,
              title: "Data-Driven",
              description: "Real-time analytics and predictive modeling",
            },
          ].map((feature) => (
            <Card
              key={feature.title}
              className="p-6 bg-white/10 backdrop-blur-lg border-0"
            >
              <div className="text-white mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-white/70">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
