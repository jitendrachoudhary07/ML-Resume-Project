import type { Route } from "./+types/home";
import Navbar from "~/Components/Navbar";
import {usePuterStore} from "~/lib/puter";
import {useLocation, useNavigate} from "react-router";
import {useEffect} from "react";
export function meta({}: Route.MetaArgs) {
  return [
    { title: "ML-Resume-Project" },
    { name: "description", content: "Welcome!" },
  ];
}

export default function Home() {
    const { auth } = usePuterStore();
    const navigate = useNavigate();

    useEffect(() => {
        if(!auth.isAuthenticated) navigate('/auth?next=/');
    }, [auth.isAuthenticated])
    return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar/>
      <section className="main-section">
            <div className="page-heading">
                <h1>Track your Applications & Resume Ratings</h1>
                <h2>Review your submissions and check AI-Powered feedback.</h2>
            </div>
      </section>
  </main>
}
