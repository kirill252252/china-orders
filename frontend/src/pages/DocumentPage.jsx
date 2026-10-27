// Раздел «Документы и ограничения»: меню слева, текст документа справа.
import { useEffect } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { SHOW_DRAFT_NOTICE, UPDATED, VERSION } from '../content/brand.js';
import { DOCUMENTS, getDocument } from '../content/documents.js';
import NotFoundPage from './NotFoundPage.jsx';

export default function DocumentPage() {
  const { slug } = useParams();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!slug) return <Navigate to={`/docs/${DOCUMENTS[0].slug}`} replace />;
  const doc = getDocument(slug);
  if (!doc) return <NotFoundPage />;

  return (
    <div className="docs-layout">
      <nav className="card docs-nav" aria-label="Документы и ограничения">
        <h2>Документы и ограничения</h2>
        {DOCUMENTS.map((d) => (
          <NavLink key={d.slug} to={`/docs/${d.slug}`}>
            {d.title}
          </NavLink>
        ))}
      </nav>

      <article className="card docs-body">
        <h1 className="page-title">{doc.title}</h1>
        <p className="muted small">
          Версия {VERSION} · обновлено {UPDATED}
        </p>
        {SHOW_DRAFT_NOTICE && (
          <div className="alert alert-info">
            Проект документа. Значения в квадратных скобках нужно заполнить, а текст проверить юристу до запуска.
          </div>
        )}
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.text?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.items && (
              <ul>
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}