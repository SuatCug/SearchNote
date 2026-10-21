// Yasal sayfaların metinleri (LegalPage.tsx gösterir). Metinler uygulamanın gerçek davranışına göre yazıldı;
// özellik değişirse (dosya limiti, görünürlük, silme davranışı vb.) buradaki ilgili cümle de güncellenmelidir.
// Taslaktır; yayına almadan önce bir hukukçuya kontrol ettirilmelidir.

import kvkkVideo from '@/assets/legal/kvkk.mp4';

// Paragraf (string) ya da madde listesi (string[]).
export type LegalBlock = string | string[];

export type LegalSection = {
  heading: string;
  blocks?: LegalBlock[];
  // Numarası bölümden türetilir: 3.1, 3.2 ...
  subsections?: { heading: string; blocks: LegalBlock[] }[];
};

export type LegalDocument = {
  title: string;
  updated?: string;
  intro?: string;
  // İçindekilerin üstünde, beyaz alanda gösterilen tanıtım videosu.
  video?: { src: string; poster?: string };
  sections: LegalSection[];
};

export const LAST_UPDATED = '2026-10-21';

const terms: LegalDocument = {
  title: 'Terms of Use',
  intro:
    'These terms apply when you use the SearchNote website or mobile app. By creating an account you agree to them. Please read them together with the Privacy Policy, the KVKK Notice and the Community Guidelines.',
  sections: [
    {
      heading: 'About SearchNote',
      blocks: [
        'SearchNote is a platform where university students share class notes, slides, summaries and past exams, and find them by school, department, course and instructor. Students can also follow each other, join study groups and send messages.',
        'SearchNote is developed and run by Suat Cuğ, an individual developer. In these terms, "we" and "us" mean SearchNote and its developer, and "you" means the person using SearchNote.',
        'SearchNote is free. There are no paid plans, no download credits and no ads.',
      ],
    },
    {
      heading: 'Your account',
      subsections: [
        {
          heading: 'Creating an account',
          blocks: [
            'You can sign up with your email address or with your Google account. If you sign up with email, we send a 6-digit code to confirm the address; the code is valid for 10 minutes. You also choose your school and department.',
            'Use your real name and your actual school and department. Accounts that pretend to be someone else may be closed.',
          ],
        },
        {
          heading: 'Keeping your account safe',
          blocks: [
            'Choose a password you do not use anywhere else and do not share it. You are responsible for what is done from your account. If you think someone else has access to it, change your password right away; if you forgot it, you can reset it with a code sent to your email.',
          ],
        },
        {
          heading: 'Deleting your account',
          blocks: [
            'You can delete your account at any time in Settings. You confirm it with a code sent to your email address, so someone who only has your phone cannot delete your account. After the account is deleted we send you a short email to let you know.',
            'Deleting your account permanently removes your profile, notes and files, comments, likes and messages. Study groups you founded are handed over to their oldest member. The KVKK Notice explains in detail what is deleted and what is kept.',
          ],
        },
      ],
    },
    {
      heading: 'Sharing notes',
      subsections: [
        {
          heading: 'What you can upload',
          blocks: [
            'You can upload notes, summaries, slides you prepared, solutions you wrote and similar study material that you made yourself or have the right to share.',
            [
              'Accepted file types: PDF, DOCX, JPG, PNG, ZIP and RAR.',
              'Maximum file size: 25 MB per note.',
              'Profile photos: JPG or PNG, up to 2 MB.',
            ],
          ],
        },
        {
          heading: 'Describing your note',
          blocks: [
            'Each note has a title and course details: course code and name, and optionally a description, the instructor and the semester. Fill them in correctly. A note whose title or details do not match the file may be removed.',
          ],
        },
        {
          heading: 'Choosing who sees it',
          blocks: [
            'For every note you choose the audience:',
            [
              'Everyone: the note can be found in search and shown on your profile and in feeds.',
              'Followers only: only people who follow you can see it.',
              'A study group: only the members of that group can see it. Group notes do not appear on your profile, in feeds or in search.',
            ],
            'You can edit the details of your note or delete it at any time. When you delete a note, its file is also removed from our storage.',
          ],
        },
      ],
    },
    {
      heading: 'Rights to your content',
      blocks: [
        'You keep all rights to the notes, comments and messages you post. We do not become the owner of your work.',
        'To run SearchNote, you give us a free, non-exclusive permission to store your content, make the technical copies needed to show it (such as previews), display its title and details in search, and let the people you chose view and download it. We use this permission only to operate SearchNote.',
        'The permission ends when you delete the content or your account. Copies that other users downloaded before that cannot be taken back.',
        'By uploading something, you confirm that you have the right to share it in this way.',
      ],
    },
    {
      heading: 'Using notes from other students',
      blocks: [
        [
          'Use downloaded notes for your own studying.',
          'Do not sell them, publish them on other websites or groups, or present them as your own work without the author\'s permission.',
          'Respect the audience the author chose. Do not share a followers-only or group note with people outside that audience.',
        ],
        'Notes are written by students and may contain mistakes. Check important information against your course materials.',
      ],
    },
    {
      heading: 'Comments, likes and follows',
      blocks: [
        'You can comment on notes you are able to see. Comments can be up to 1,000 characters and are visible to everyone who can see the note. You can delete your own comments, and the author of a note can delete comments on it.',
        'Likes are public: people who can see a note can also see who liked it. Your followers and the people you follow are shown on your profile. You can remove a follower at any time.',
      ],
    },
    {
      heading: 'Study groups',
      blocks: [
        'Any user can create a study group, for example for a course. A group can be public, so anyone can join, or private, so the founder has to approve each join request.',
        [
          'Notes and chat messages in a group are visible only to its members.',
          'The founder can edit the group, approve or reject join requests, remove members, hand the group over to another member or delete it.',
          'When a group is deleted, the notes shared in it and its chat messages are deleted too, including notes shared by other members. Keep your own copy of anything you share in a group.',
          'Founders are expected to keep their groups on topic and remove members who break these terms.',
          'You can leave a group at any time.',
        ],
      ],
    },
    {
      heading: 'Messages',
      blocks: [
        'You can send direct messages to other users. Messages can be up to 2,000 characters and you can attach notes to them.',
        [
          'You can edit or unsend your own messages. An unsent message is removed for both people.',
          'Deleting a conversation removes it only from your side; the other person still sees it.',
          'The other person can see when you have read their messages.',
          'You can block a user at any time. Blocked users cannot message or follow you.',
        ],
        'To prevent spam, the number of new conversations you can start in a short time is limited.',
      ],
    },
    {
      heading: 'What is not allowed',
      blocks: [
        'You may not use SearchNote to post or do any of the following:',
        [
          'Copyrighted textbooks, books, paid course packs or publisher slides.',
          'Exam questions or materials your instructor asked to keep private.',
          'Other people\'s personal information, photos or contact details without their consent.',
          'Harassment, threats, hate speech or content that targets a person or group.',
          'Spam, advertising or repeated unwanted messages.',
          'Files that contain malware, or files that are not what their title says.',
          'Pretending to be another person or organization.',
          'Collecting content or user information in bulk with bots or scripts.',
          'Trying to get around limits, access other accounts or overload the service.',
          'Anything that is against the law.',
        ],
        'The Community Guidelines give more examples of what is and is not welcome.',
      ],
    },
    {
      heading: 'Reports and enforcement',
      blocks: [
        'You can report a user from their profile and choose a reason: spam, harassment, inappropriate content, impersonation, copyright or other. To report a note, use the contact form and include the link to the note.',
        'We review reports and may remove content, warn the user, or close the account, depending on how serious the problem is and whether it happened before. We do not check every note before it is published, but we act on what we find or what is reported to us.',
      ],
    },
    {
      heading: 'Availability of the service',
      blocks: [
        'SearchNote is run by one developer on free and low-cost services. It may be slow to start after a quiet period, it may be unavailable during maintenance, and features may change or be removed. If we ever decide to shut SearchNote down, we will try to give notice in advance so you can download your notes.',
      ],
    },
    {
      heading: 'No warranty and limitation of liability',
      blocks: [
        'SearchNote is provided free of charge and "as is". We do not guarantee that the service will always be available or free of errors, or that any note is correct or complete.',
        'As far as the law allows, we are not liable for indirect losses, such as a lower grade or lost data, that come from using SearchNote or the content on it. Nothing in these terms limits liability that cannot be limited by law.',
      ],
    },
    {
      heading: 'Ending your use',
      blocks: [
        'You can stop using SearchNote and delete your account at any time. We may suspend or close an account that seriously or repeatedly breaks these terms, or when the law requires it.',
      ],
    },
    {
      heading: 'Changes to these terms',
      blocks: [
        'We may update these terms when SearchNote changes or when the law requires it. The date at the top of this page shows the current version. If you keep using SearchNote after a change, the updated terms apply to you.',
      ],
    },
    {
      heading: 'Applicable law and contact',
      blocks: [
        'These terms are governed by the laws of the Republic of Türkiye. For questions about these terms, write to us through the contact form.',
      ],
    },
  ],
};

const privacy: LegalDocument = {
  title: 'Privacy Policy',
  intro:
    'This page explains in plain words what SearchNote knows about you, why, and who can see what. The formal information required by the Turkish Personal Data Protection Law is in the KVKK Notice.',
  sections: [
    {
      heading: 'Who is responsible',
      blocks: [
        'SearchNote is developed and run by Suat Cuğ, an individual developer, who is responsible for the personal data described here. You can reach us through the contact form by choosing the "Privacy & KVKK request" topic.',
      ],
    },
    {
      heading: 'Information you give us',
      subsections: [
        {
          heading: 'Account and profile',
          blocks: [
            'Your name, email address, school and department, and your password. If you want, you can also add a bio of up to 500 characters and a profile photo.',
          ],
        },
        {
          heading: 'Notes',
          blocks: [
            'The files you upload and the details you add to them: title, description, course code and name, instructor and semester, and the audience you chose.',
          ],
        },
        {
          heading: 'Activity',
          blocks: [
            'Your comments, likes, saved notes, the people you follow and block, the study groups you create or join, your favorite groups and your join requests.',
          ],
        },
        {
          heading: 'Messages',
          blocks: [
            'Direct messages and group chat messages, including replies, edits and notes you attach to them.',
          ],
        },
        {
          heading: 'Reports and contact messages',
          blocks: [
            'When you report a user, we keep the reason and the details you wrote. When you use the contact form, we keep your name, email address, the topic and your message.',
          ],
        },
      ],
    },
    {
      heading: 'Information collected automatically',
      blocks: [
        [
          'When you were last active on SearchNote, updated at most once a minute while you use it.',
          'Whether you are online right now, while the app or website is open.',
          'When you last read each conversation, to show read receipts.',
          'Notifications about activity on your account, such as likes, comments, new followers and group requests. They are deleted automatically after 90 days.',
          'On the mobile app: a push notification token for your device and the notification settings you choose. The token is removed when you log out.',
        ],
        'The services that host SearchNote may also keep standard technical logs, such as IP addresses and request times, to keep their systems secure.',
      ],
    },
    {
      heading: 'Information from Google',
      blocks: [
        'If you choose "Continue with Google", Google shares your name, email address and profile photo with us, together with an ID that links your Google account to your SearchNote account. We do not get access to your Google password, contacts, files or anything else.',
      ],
    },
    {
      heading: 'How we use your information',
      blocks: [
        [
          'To create your account, confirm your email address and keep you signed in.',
          'To show your profile and notes, and to let other students find notes by school, department, course and instructor.',
          'To suggest people you may know, such as students from your school.',
          'To run comments, likes, follows, study groups and messages.',
          'To send you notifications and the emails described below.',
          'To prevent spam and abuse, handle reports and copyright complaints, and answer your requests.',
          'To meet our legal obligations.',
        ],
        'We do not show ads, we do not sell your data and we do not use it to build advertising profiles.',
      ],
    },
    {
      heading: 'What other people can see',
      blocks: [
        [
          'Your name, school, department, bio and profile photo are visible to anyone who opens your profile, including visitors who are not signed in.',
          'Your followers and the people you follow are listed on your profile.',
          'Each note is visible only to the audience you chose: everyone, your followers, or the members of one study group. Comments and likes on a note are visible to everyone who can see that note.',
          'Signed-in users can find you by name in search.',
          'People who follow you and whom you follow back can see when you are online.',
          'In a direct message, the other person can see when you were last active and whether you read their messages.',
          'In a private study group, only members can see who else is in the group.',
        ],
        'Your email address is never shown to other users.',
      ],
    },
    {
      heading: 'Emails and notifications',
      blocks: [
        'We only send emails that are needed for your account: the code to confirm your email address, password reset codes, account deletion codes and a message after your account is deleted. We do not send newsletters or marketing emails.',
        'Inside the app you get notifications about likes, comments, new followers and study group activity. On the mobile app you can choose which of them also arrive as push notifications, or pause them for a while.',
      ],
    },
    {
      heading: 'Services we use',
      blocks: [
        'SearchNote relies on these outside services to work. They process data only to provide their service to us:',
        [
          'MongoDB Atlas: stores the database.',
          'Render: runs the SearchNote server.',
          'Netlify: hosts the website.',
          'Cloudinary: stores note files and profile photos.',
          'Brevo: delivers our emails.',
          'Google: provides "Continue with Google" and the fonts on the website.',
          'Expo: delivers push notifications to the mobile app.',
        ],
        'Some of these services keep data on servers outside Türkiye. The KVKK Notice explains this in more detail.',
      ],
    },
    {
      heading: 'How long we keep information',
      blocks: [
        'We keep your information while your account is open. When you delete your account, your profile, notes and files, comments, likes, messages, notifications and reports are permanently deleted. Contact form messages are kept without a link to your account so we can follow up on earlier requests.',
        'Some information is deleted sooner: notifications after 90 days, and one-time codes as soon as they expire, usually within 10 minutes.',
      ],
    },
    {
      heading: 'Security',
      blocks: [
        'Passwords and one-time codes are stored only as one-way hashes, so nobody can read them, including us. Note files are not published at open links; they are delivered only to people who are allowed to see the note. All traffic between your device and SearchNote is encrypted.',
        'No online service can be completely secure. If we learn about a security problem that affects your data, we will let you know as the law requires.',
      ],
    },
    {
      heading: 'Your choices',
      blocks: [
        [
          'Edit your profile, or remove your profile photo, at any time.',
          'Change the audience of a note, or delete any note or comment you posted.',
          'Remove followers and block users.',
          'Choose which push notifications you get in the mobile app.',
          'Delete your account in Settings.',
        ],
        'You also have the rights listed in Article 11 of KVKK. The KVKK Notice explains them and how to use them.',
      ],
    },
    {
      heading: 'Changes to this policy',
      blocks: [
        'If we change how SearchNote uses personal data, we will update this page and the date at the top.',
      ],
    },
  ],
};

const kvkk: LegalDocument = {
  title: 'KVKK Notice',
  video: { src: kvkkVideo },
  intro:
    'This notice is given under Article 10 of the Turkish Personal Data Protection Law No. 6698 (KVKK). It explains which personal data SearchNote processes when you use the website or the mobile app, why we process it, who receives it and how you can use your rights.',
  sections: [
    {
      heading: 'Data controller',
      blocks: [
        'SearchNote is developed and run by Suat Cuğ, an individual developer, who is the data controller for the personal data processed on the SearchNote website and mobile app. You can reach us through the contact form by choosing the "Privacy & KVKK request" topic.',
      ],
    },
    {
      heading: 'Personal data we process',
      blocks: [
        [
          'Identity: full name, profile photo and bio.',
          'Contact: email address.',
          'Education: university and department.',
          'Account security: your password (stored only as a one-way hash), one-time email codes for verification, password reset and account deletion (also stored as hashes), and your Google account ID if you use "Continue with Google".',
          'Content and activity: notes and uploaded files, comments, likes, saved notes, follows, blocked users, study groups and favorite groups, group and direct messages, reports you submit and contact form messages.',
          'Usage: when you were last active, your online status and message read receipts, in-app notifications, and on the mobile app your push notification token and notification preferences.',
        ],
      ],
    },
    {
      heading: 'How we collect it',
      blocks: [
        'Personal data is collected electronically through the SearchNote website and mobile app:',
        [
          'Directly from you, when you sign up, fill in your profile, upload notes, use messaging and groups, submit a report or use the contact form.',
          'Automatically while you use SearchNote, for example your last active time and online status.',
          'From Google (your name, email address and profile photo), only if you choose to sign in with your Google account.',
        ],
      ],
    },
    {
      heading: 'Why we process it',
      blocks: [
        [
          'To create and verify your account and keep it secure.',
          'To show your profile and notes and let other students find them by school, department and course.',
          'To run study groups, comments, follows and messaging.',
          'To send verification, password reset and account deletion emails and, on the mobile app, push notifications.',
          'To prevent spam and abuse and to handle reports and copyright complaints.',
          'To answer your contact requests and meet our legal obligations.',
        ],
      ],
    },
    {
      heading: 'Legal basis',
      blocks: [
        'We process your personal data on the following grounds listed in Article 5(2) of KVKK:',
        [
          'It is necessary to set up and perform the service you signed up for (Article 5(2)(c)): your account, profile, notes, groups and messages.',
          'It is necessary to comply with our legal obligations (Article 5(2)(ç)), for example answering requests from authorities.',
          'Profile details and notes you share publicly are data you have made public yourself (Article 5(2)(d)).',
          'It is necessary to establish, exercise or defend a right (Article 5(2)(e)), for example in a copyright dispute.',
          'It is necessary for our legitimate interest in keeping the platform secure and free of spam, without harming your rights (Article 5(2)(f)).',
        ],
        'We do not use your data for advertising and we do not sell it.',
      ],
    },
    {
      heading: 'Who can see or receive it',
      blocks: [
        [
          'Other users see your profile and the notes you share according to the visibility you choose: everyone, followers only or a study group. Your email address is never shown publicly.',
          'Service providers that run SearchNote for us: MongoDB Atlas (database), Render (server), Netlify (website hosting), Cloudinary (file and profile photo storage), Brevo (email delivery), Google (sign-in and web fonts) and Expo (mobile push notifications).',
          'Public authorities, when the law requires it.',
        ],
      ],
    },
    {
      heading: 'Transfers abroad',
      blocks: [
        'The providers listed above store or process data on servers located outside Türkiye, so using SearchNote involves transferring personal data abroad within the meaning of Article 9 of KVKK.',
      ],
    },
    {
      heading: 'How long we keep it',
      blocks: [
        'We keep your data while your account is open. When you delete your account from Settings, your profile, notes and files, comments, likes, group and direct messages, notifications and reports are permanently deleted, and you are removed from other users\' follower and block lists. Study groups you founded are handed over to their oldest member, or deleted if no members remain. Contact form messages are kept without a link to your account. In-app notifications are deleted automatically after 90 days, and one-time email codes expire shortly after they are sent.',
      ],
    },
    {
      heading: 'Your rights',
      blocks: [
        'Under Article 11 of KVKK you have the right:',
        [
          'To learn whether your personal data is processed and to request information about it.',
          'To learn the purpose of processing and whether it is used for that purpose.',
          'To know the third parties in Türkiye or abroad that receive it.',
          'To ask for incomplete or incorrect data to be corrected.',
          'To ask for your data to be deleted or destroyed under Article 7.',
          'To ask that third parties who received your data be informed of these corrections or deletions.',
          'To object to a result against you that comes solely from automated analysis.',
          'To claim compensation if you suffer damage from unlawful processing.',
        ],
      ],
    },
    {
      heading: 'How to use your rights',
      blocks: [
        'You can edit your profile and delete your notes, comments or entire account yourself at any time in Settings. For any other request, use the contact form with the "Privacy & KVKK request" topic and describe your request clearly. We may ask you to confirm your identity, for example by writing from the email address on your account.',
        'We answer requests free of charge within 30 days at the latest, as set out in Article 13 of KVKK. If you are not satisfied with our answer, you can complain to the Personal Data Protection Board (KVKK Kurulu).',
      ],
    },
  ],
};

const copyright: LegalDocument = {
  title: 'Copyright Policy',
  intro:
    'Notes on SearchNote are uploaded by students. This page explains what may be shared, and what to do if you find your work on SearchNote without your permission.',
  sections: [
    {
      heading: 'Our approach',
      blocks: [
        'SearchNote is for sharing study material that students make themselves. Textbooks, books, lecture materials and similar works are protected under the Law on Intellectual and Artistic Works No. 5846 (FSEK), and their authors decide who may copy and share them. We remove content that is shared without the right to do so.',
      ],
    },
    {
      heading: 'What you can share',
      blocks: [
        [
          'Notes you took in class, handwritten or typed.',
          'Summaries, mind maps and study sheets you prepared.',
          'Solutions to exercises that you wrote yourself.',
          'Slides or documents you created, for example for a presentation.',
          'Material from your instructor, only if your instructor allowed you to share it.',
        ],
      ],
    },
    {
      heading: 'What you should not upload',
      blocks: [
        [
          'Scanned or photographed pages of textbooks and books.',
          'Paid course packs, test books or publisher slides and question banks.',
          'Lecture slides, notes or exam papers your instructor did not allow you to share.',
          'Another student\'s notes, uploaded as your own or without their permission.',
          'Material from paid online courses or websites.',
        ],
        'Writing a source at the top of a file does not make it allowed to share. What matters is whether the owner of the work gave permission.',
      ],
    },
    {
      heading: 'Reporting your work',
      subsections: [
        {
          heading: 'Who can report',
          blocks: [
            'The owner of the work, such as an author, instructor, publisher or student, or someone authorized to act for them.',
          ],
        },
        {
          heading: 'What to include',
          blocks: [
            [
              'The link to each note on SearchNote that contains your work.',
              'A description of your original work, for example the book title and pages, or the course and lecture.',
              'Something that shows you own the work or act for its owner.',
              'Your name and an email address where we can reach you.',
              'A statement that the information in your report is correct.',
            ],
          ],
        },
        {
          heading: 'Where to send it',
          blocks: [
            'Use the contact form and choose the "Copyright / report content" topic. Reports with all of the information above can be handled fastest.',
          ],
        },
      ],
    },
    {
      heading: 'What happens after a report',
      blocks: [
        'We review every report. If the note clearly uses your work without permission, we remove it and may let the uploader know why. If something is unclear, we may ask you for more information. As a hosting provider under Law No. 5651, SearchNote removes unlawful content once it is notified about it.',
      ],
    },
    {
      heading: 'If your note was removed',
      blocks: [
        'If you think your note was removed by mistake, for example because you are its author or you had permission to share it, write to us through the contact form with the same topic and explain why. If you are right, we restore the note.',
      ],
    },
    {
      heading: 'Repeated violations and false reports',
      blocks: [
        'Accounts that keep uploading other people\'s work may be closed. Reports must be made in good faith; knowingly reporting content that you do not own, to have it removed, is also a misuse of SearchNote.',
      ],
    },
  ],
};

const cookies: LegalDocument = {
  title: 'Cookie Policy',
  intro:
    'SearchNote does not use advertising, analytics or tracking cookies. This page lists the small amount of information kept in your browser and the outside services that load when you use the site.',
  sections: [
    {
      heading: 'Cookies and local storage',
      blocks: [
        'Cookies are small files that websites save in your browser. Local storage is a similar space in the browser that only the website itself can read. SearchNote does not set cookies of its own; it uses local storage for the two things listed below.',
      ],
    },
    {
      heading: 'What SearchNote stores in your browser',
      blocks: [
        [
          'Sign-in session (notehub_auth): a token and your basic profile details, so you stay signed in. It is sent only to SearchNote, with your requests. Without it you would have to sign in on every visit.',
          'Recent searches (searchnote:recent-searches:…): your last searches in the search box, saved separately for each account on that browser. They never leave your device.',
        ],
      ],
    },
    {
      heading: 'Outside services',
      blocks: [
        'Some parts of the site load from other companies. When that happens, your browser connects to them directly and they receive your IP address:',
        [
          'Google Fonts: the fonts on the site load from Google.',
          'Google sign-in: on the sign-in and sign-up pages, the "Continue with Google" button loads from Google, which may set its own cookies under Google\'s policies.',
          'Cloudinary: profile photos load from Cloudinary.',
        ],
      ],
    },
    {
      heading: 'What we do not use',
      blocks: [
        [
          'Analytics tools that track how you use the site.',
          'Advertising cookies or ad networks.',
          'Social media pixels or share buttons that follow you across websites.',
        ],
      ],
    },
    {
      heading: 'Mobile app',
      blocks: [
        'The mobile app keeps you signed in on your device in a similar way and does not use tracking or advertising tools either.',
      ],
    },
    {
      heading: 'Managing it',
      blocks: [
        'Logging out removes your session from the browser. You can clear your recent searches from the search box. To remove everything, clear the site data for SearchNote in your browser settings. If your browser blocks local storage, SearchNote will still open but you will not be able to stay signed in.',
      ],
    },
    {
      heading: 'Changes to this policy',
      blocks: [
        'If we start using anything new in your browser, we will update this page and the date at the top before it goes live.',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = { terms, privacy, kvkk, copyright, cookies };
