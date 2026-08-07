/* The dataset's own crime vocabulary, kept in one place.

   Split out of i18n.tsx so the translation provider stays a component module:
   these are plain data exports, and mixing them in with the provider breaks Fast
   Refresh for the whole file. */

export const crimeTypes: Record<string, string> = {
  'Arms Act Violations': 'ಶಸ್ತ್ರಾಸ್ತ್ರ ಕಾಯ್ದೆ ಉಲ್ಲಂಘನೆ',
  'Cheating & Fraud': 'ವಂಚನೆ ಮತ್ತು ಮೋಸ',
  'Crimes Against Body': 'ದೇಹದ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Children': 'ಮಕ್ಕಳ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Property': 'ಆಸ್ತಿ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Public Tranquility': 'ಸಾರ್ವಜನಿಕ ಶಾಂತಿ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Crimes Against Women': 'ಮಹಿಳೆಯರ ವಿರುದ್ಧ ಅಪರಾಧಗಳು',
  'Cyber Crimes': 'ಸೈಬರ್ ಅಪರಾಧಗಳು',
  'Domestic Violence': 'ಕೌಟುಂಬಿಕ ಹಿಂಸೆ',
  'Economic Offences': 'ಆರ್ಥಿಕ ಅಪರಾಧಗಳು',
  'Environmental Offences': 'ಪರಿಸರ ಅಪರಾಧಗಳು',
  'Forgery & Counterfeiting': 'ನಕಲಿ ಮತ್ತು ಖೋಟಾ',
  'Gambling & Betting': 'ಜೂಜು ಮತ್ತು ಬೆಟ್ಟಿಂಗ್',
  'Kidnapping & Abduction': 'ಅಪಹರಣ',
  'Motor Vehicle Offences': 'ಮೋಟಾರು ವಾಹನ ಅಪರಾಧಗಳು',
  'Narcotics & Drugs': 'ಮಾದಕ ದ್ರವ್ಯಗಳು',
  'Other IPC Offences': 'ಇತರ IPC ಅಪರಾಧಗಳು',
  'Public Order Violations': 'ಸಾರ್ವಜನಿಕ ಸುವ್ಯವಸ್ಥೆ ಉಲ್ಲಂಘನೆ',
  'Robbery & Dacoity': 'ದರೋಡೆ ಮತ್ತು ಡಕಾಯಿತಿ',
  'Sexual Offences': 'ಲೈಂಗಿಕ ಅಪರಾಧಗಳು',
}

/* The 20 CrimeGroupName values the pipeline uses, alphabetical. Exported so the
   report portal offers exactly this vocabulary and nothing else — a category
   outside this list could never convert into an FIR row, and would need a
   mapping table that would go stale. */
export const CRIME_CATEGORIES: readonly string[] = Object.keys(crimeTypes).sort()

/* Plain-language gloss per category. The dataset's own name is kept; this is
   only what the category covers, shown on hover. */
export const crimeGlossEn: Record<string, string> = {
  'Arms Act Violations': 'Illegal possession, carrying or sale of weapons',
  'Cheating & Fraud': 'Deception for money or property, including forgery of intent',
  'Crimes Against Body': 'Physical harm to a person — assault, hurt, culpable homicide and murder',
  'Crimes Against Children': 'Offences where the victim is a minor',
  'Crimes Against Property': 'Theft, burglary, house-breaking and criminal trespass',
  'Crimes Against Public Tranquility': 'Rioting, unlawful assembly and affray',
  'Crimes Against Women': 'Offences where the victim is a woman, including cruelty and harassment',
  'Cyber Crimes': 'Offences committed through computers, phones or the internet',
  'Domestic Violence': 'Violence or cruelty by a family member or partner',
  'Economic Offences': 'Financial crime — criminal breach of trust, misappropriation',
  'Environmental Offences': 'Damage to forest, wildlife, water or air under environmental law',
  'Forgery & Counterfeiting': 'Fake documents, seals, signatures or currency',
  'Gambling & Betting': 'Running or taking part in unlawful gaming and wagering',
  'Kidnapping & Abduction': 'Taking or carrying away a person against their will',
  'Motor Vehicle Offences': 'Road and traffic offences, including rash and negligent driving',
  'Narcotics & Drugs': 'Possession, sale or trafficking of controlled substances',
  'Other IPC Offences': 'IPC offences not falling under the other categories',
  'Public Order Violations': 'Obstruction, public nuisance and disobedience of lawful orders',
  'Robbery & Dacoity': 'Theft with force or the threat of force; dacoity is five or more offenders',
  'Sexual Offences': 'Rape, sexual assault and related offences',
}

export const crimeGlossKn: Record<string, string> = {
  'Arms Act Violations': 'ಶಸ್ತ್ರಾಸ್ತ್ರಗಳ ಅಕ್ರಮ ಸ್ವಾಧೀನ, ಸಾಗಣೆ ಅಥವಾ ಮಾರಾಟ',
  'Cheating & Fraud': 'ಹಣ ಅಥವಾ ಆಸ್ತಿಗಾಗಿ ಮೋಸ, ಉದ್ದೇಶಪೂರ್ವಕ ವಂಚನೆ ಸೇರಿದಂತೆ',
  'Crimes Against Body': 'ವ್ಯಕ್ತಿಗೆ ದೈಹಿಕ ಹಾನಿ — ಹಲ್ಲೆ, ಗಾಯ, ಸಾವಿಗೆ ಕಾರಣವಾಗುವ ಕೃತ್ಯ ಮತ್ತು ಕೊಲೆ',
  'Crimes Against Children': 'ಸಂತ್ರಸ್ತರು ಅಪ್ರಾಪ್ತ ವಯಸ್ಕರಾಗಿರುವ ಅಪರಾಧಗಳು',
  'Crimes Against Property': 'ಕಳ್ಳತನ, ಮನೆ ಒಡೆದು ಕಳ್ಳತನ ಮತ್ತು ಅಕ್ರಮ ಪ್ರವೇಶ',
  'Crimes Against Public Tranquility': 'ಗಲಭೆ, ಕಾನೂನುಬಾಹಿರ ಸಭೆ ಮತ್ತು ಜಗಳ',
  'Crimes Against Women': 'ಸಂತ್ರಸ್ತರು ಮಹಿಳೆಯಾಗಿರುವ ಅಪರಾಧಗಳು, ಕ್ರೌರ್ಯ ಮತ್ತು ಕಿರುಕುಳ ಸೇರಿದಂತೆ',
  'Cyber Crimes': 'ಗಣಕಯಂತ್ರ, ದೂರವಾಣಿ ಅಥವಾ ಅಂತರ್ಜಾಲದ ಮೂಲಕ ನಡೆಸಿದ ಅಪರಾಧಗಳು',
  'Domestic Violence': 'ಕುಟುಂಬದ ಸದಸ್ಯ ಅಥವಾ ಸಂಗಾತಿಯಿಂದ ಹಿಂಸೆ ಅಥವಾ ಕ್ರೌರ್ಯ',
  'Economic Offences': 'ಆರ್ಥಿಕ ಅಪರಾಧ — ನಂಬಿಕೆ ದ್ರೋಹ, ದುರುಪಯೋಗ',
  'Environmental Offences': 'ಪರಿಸರ ಕಾನೂನಿನಡಿ ಅರಣ್ಯ, ವನ್ಯಜೀವಿ, ನೀರು ಅಥವಾ ಗಾಳಿಗೆ ಹಾನಿ',
  'Forgery & Counterfeiting': 'ನಕಲಿ ದಾಖಲೆ, ಮುದ್ರೆ, ಸಹಿ ಅಥವಾ ನೋಟು',
  'Gambling & Betting': 'ಕಾನೂನುಬಾಹಿರ ಜೂಜು ಮತ್ತು ಬೆಟ್ಟಿಂಗ್ ನಡೆಸುವುದು ಅಥವಾ ಭಾಗವಹಿಸುವುದು',
  'Kidnapping & Abduction': 'ವ್ಯಕ್ತಿಯ ಇಚ್ಛೆಗೆ ವಿರುದ್ಧವಾಗಿ ಕರೆದೊಯ್ಯುವುದು',
  'Motor Vehicle Offences': 'ರಸ್ತೆ ಮತ್ತು ಸಂಚಾರ ಅಪರಾಧಗಳು, ಅಜಾಗರೂಕ ಚಾಲನೆ ಸೇರಿದಂತೆ',
  'Narcotics & Drugs': 'ನಿಷೇಧಿತ ಮಾದಕ ವಸ್ತುಗಳ ಸ್ವಾಧೀನ, ಮಾರಾಟ ಅಥವಾ ಸಾಗಣೆ',
  'Other IPC Offences': 'ಇತರ ವರ್ಗಗಳಿಗೆ ಸೇರದ IPC ಅಪರಾಧಗಳು',
  'Public Order Violations': 'ಅಡಚಣೆ, ಸಾರ್ವಜನಿಕ ಉಪದ್ರವ ಮತ್ತು ಕಾನೂನುಬದ್ಧ ಆದೇಶ ಉಲ್ಲಂಘನೆ',
  'Robbery & Dacoity': 'ಬಲ ಅಥವಾ ಬೆದರಿಕೆಯೊಂದಿಗೆ ಕಳ್ಳತನ; ಐದು ಅಥವಾ ಹೆಚ್ಚು ಆರೋಪಿಗಳಿದ್ದರೆ ಡಕಾಯಿತಿ',
  'Sexual Offences': 'ಅತ್ಯಾಚಾರ, ಲೈಂಗಿಕ ದೌರ್ಜನ್ಯ ಮತ್ತು ಸಂಬಂಧಿತ ಅಪರಾಧಗಳು',
}
