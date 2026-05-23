import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { SiteSkill } from './types.js';
import { logger } from '../cli/ui/logger.js';

export class SkillLoader {
  private skills: SiteSkill[] = [];

  constructor(skillsDir: string = path.join(process.cwd(), 'data', 'skills')) {
    this.load(skillsDir);
  }

  private load(dir: string): void {
    if (!existsSync(dir)) return;

    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = readFileSync(path.join(dir, file), 'utf-8');
        const skill = JSON.parse(raw) as SiteSkill;
        if (skill.name && skill.domain && skill.context) {
          this.skills.push(skill);
          logger.debug(`Skill loaded: ${skill.name} (${skill.domain})`);
        }
      } catch (err) {
        logger.debug(`Failed to load skill file ${file}: ${(err as Error).message}`);
      }
    }

    if (this.skills.length > 0) {
      logger.debug(`${this.skills.length} site skill(s) available`);
    }
  }

  matchUrl(url: string): SiteSkill | null {
    for (const skill of this.skills) {
      if (url.includes(skill.domain)) return skill;
    }
    return null;
  }

  getAll(): SiteSkill[] {
    return this.skills;
  }
}
