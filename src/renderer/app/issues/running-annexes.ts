import { Publication } from 'main/lists/models';
import { OBIssue } from 'main/issues/models';
import { Index, QuerySet, sortIntegerAscending } from 'main/storage/query';


export interface RunningAnnex {
  publication: Publication,
  annexedTo: OBIssue,
  positionOn: Date | null,
}


// Runs through past issues (relative to given issue) and builds a list
// of annexed publications.
export function getRunningAnnexesForIssue(
    issue: OBIssue,
    issueIndex: Index<OBIssue>,
    publicationIndex: Index<Publication>): RunningAnnex[] {

  const pastIssues = new QuerySet<OBIssue>(issueIndex).
    orderBy(sortIntegerAscending).
    filter((item: [string, OBIssue]) => item[1].id < issue.id).all();

  var runningAnnexes: RunningAnnex[] = [];

  for (const pastIssue of pastIssues) {
    const annexes = Object.entries(pastIssue.annexes || {});
    for (const [annexedPublicationId, annexedPublicationPosition] of annexes) {
      const pub = publicationIndex[annexedPublicationId];
      if (pub && runningAnnexes.find(ann => ann.publication.id == pub.id) === undefined) {
        const position = annexedPublicationPosition;
        runningAnnexes.push({
          publication: pub as Publication,
          annexedTo: pastIssue,
          positionOn: position ? (position.position_on as Date) : null,
        });
      }
    }
  }

  return runningAnnexes;
}
