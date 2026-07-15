import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="content-card narrow-card">
      <p className="eyebrow">Page not found</p>
      <h1>This study screen does not exist</h1>
      <Link className="button button-primary" to="/">Return to the study welcome page</Link>
    </section>
  );
}

