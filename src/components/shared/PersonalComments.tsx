import { commentText } from '../../lib/personalization';

export function PersonalComments({ comment }: { comment?: string | null }) {
  return <section className="personal-comments" aria-label="Personal comments">
    <h3 className="mono">Personal comments</h3>
    <p>{commentText(comment)}</p>
  </section>;
}
