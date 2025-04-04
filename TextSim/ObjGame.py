import numpy as np
from play_data import Play_Data

class Stats:
    def __init__(self):
        self.runs = 0
        self.run_yds = 0
        self.passes = 0
        self.comps = 0
        self.pass_yds = 0
        self.scrambles = 0
        self.ints = 0
        self.fumbles = 0
        self.sacks = 0
        self.punts = 0
        self.fds = 0

    def update_run(self, play, ryds):
        self.runs+=1
        if(play=='rfumble'):
            self.fumbles+=1
        else:
            self.run_yds += ryds

    def update_pass(self, play, pyds):
        if(play=='int'):
            self.ints+=1
            self.passes+=1
        elif(play=='pfumble'):
            self.fumbles+=1
            self.passes+=1
        elif(play=='inc'):
            self.passes+=1
        elif(play=='sack'):
            self.sacks+=1
        elif(play=='scramble'):
            self.scrambles+=1
            self.run_yds+=pyds
        else:
            self.passes+=1
            self.comps+=1
            self.pass_yds+=pyds

class Team:
    def __init__(self, name, score):
        self.name = name
        self.score = score
        self.stats = Stats()

class Field:
    def __init__(self, F_SIZE = 100, FD = 10, ED = 10, ND = 4):
        self.FIELD_SIZE = F_SIZE
        self.FD = FD  # first down
        self.ED = ED  # endzone
        self.ND = ND
        self.loc = self.FIELD_SIZE/2
        self.target = self.FIELD_SIZE/2
        self.down = 1

    def set_ball(self, new_loc):
        self.loc = new_loc

    def switch_pos(self):
        self.loc = self.FIELD_SIZE-self.loc
        self.down = 1
        self.target = self.FIELD_SIZE-self.target

    def set_target(self):
        self.target = self.loc - self.FD if self.loc >= self.FD else 0

    def is_td(self):
        return self.loc <= 0
    
    def is_sft(self):
        return self.loc >= self.FIELD_SIZE
    
    def is_fd(self):
        return self.loc <= self.target
    
    def get_distance(self):
        return self.loc - self.target
    
    def is_tb(self):
        return self.is_td(self)
    
    def update_pos(self, yds):
        self.loc -= yds
        self.down+=1

        result = ''

        if(self.get_distance() <= 0):
            result = 'first down'
            self.down = 1
            self.set_target()
        elif(self.down > 4):
            result = 'turnover on downs'

        if self.is_td():
            result = 'touchdown'
        elif self.is_sft():
            result = 'safety'

        return result
    
    def set_loc(self, loc):
        self.loc = loc
    
    def new_downs(self):
        self.down = 1
        self.set_target()

class Game:
    def __init__(self, name1, name2, init_time, pd1, pd2, fd = 10, nd = 4, td = 6, xp = 1, tpt = 2, fg = 3, sft = 2, ED_SIZE = 10, F_SIZE = 100):
        self.name1 = name1
        self.name2 = name2
        self.team1 = Team(name1, 0)
        self.team2 = Team(name2, 0)
        self.pos = None
        self.time = init_time
        self.pd1 = pd1
        self.pd2 = pd2
        self.field = Field(F_SIZE=F_SIZE, FD=fd, ED=ED_SIZE, ND=nd)
        
        # Score Constants
        self.FD = fd
        self.ND = nd
        self.TD = td
        self.FG = fg
        self.XP = xp
        self.TPT = tpt
        self.SFT = sft
        self.ED_SIZE = ED_SIZE
        self.F_SIZE = F_SIZE

    def reset(self):
        self.team1 = Team(self.team1.name)
        self.team2 = Team(self.team2.name)
        self.field = Field(F_SIZE=self.F_SIZE, FD=self.FD, ED=self.ED_SIZE)

    def toss(self):
        toss_val = int(np.random.uniform(0, 2))+1
        if toss_val == 1:
            self.pos = self.team1
        else:
            self.pos = self.team2

        return self.pos
    
    def kickoff(self):
        loc = self.get_kickoff_pos()
        self.field.set_loc(loc)
        self.new_downs()
    
    def is_done(self):
        return self.time<=0


    ### PLAY STUFF

    def get_run_val(self):
        pd = self.pd1 if self.pos.name == self.team1.name else self.pd2
        return pd.get_run_val(self.field.down, self.field.get_distance(), self.field.loc)
    
    def get_pass_val(self):
        pd = self.pd1 if self.pos.name == self.team1.name else self.pd2
        return pd.get_pass_val(self.field.down, self.field.get_distance(), self.field.loc)
    
    def get_punt_val(self):
        num = int(np.random.normal(45, 10))
        if num < 5:
            num = 5
        return num
    
    def get_kickoff_pos(self):
        return int(np.random.normal(70, 1))
    
    def update_score(self, amnt):
        self.pos.score += amnt

    def switch_pos(self):
        if(self.pos.name==self.team1.name):
            self.pos = self.team2
        else:
            self.pos = self.team1
        self.field.switch_pos()

    def new_downs(self):
        self.field.new_downs()
    
    def touchback(self):
        self.field.set_loc(80)
        self.new_downs()

    def run(self):
        yds = self.get_run_val()
        yds = yds if yds <= self.field.loc else self.field.loc

        if(yds <= -1000):
            play = 'rfumble'
            yds = (yds+1100)
        else:
            play = 'run'

        yds = yds if yds >= (self.field.loc-self.F_SIZE) else (self.field.loc-self.F_SIZE)

        result = self.field.update_pos(yds)
        self.pos.stats.update_run(play, yds)

        self.time -= 1

        return (play, result, yds)

    def throw(self):
        yds = self.get_pass_val()
        yds = yds if yds <= self.field.loc else self.field.loc

        if(yds <= -2000):
            play = 'int'
            yds = (yds+2100)
        elif(yds <= -1000):
            play = 'pfumble'
            yds = (yds+1100)
        elif(yds <= -3):
            play = 'sack'
        elif(yds == 0):
            play = 'inc'
        elif(yds > 0 and yds <= 15):
            val = np.random.uniform()
            if(val <= 0.06):
                play = 'scramble'
            else:
                play = 'pass'
        else:
            play = 'pass'

        yds = yds if yds >= (self.field.loc-self.F_SIZE) else (self.field.loc-self.F_SIZE)

        result = self.field.update_pos(yds)
        self.pos.stats.update_pass(play, yds)
        if result == 'first down' or result == 'touchdown':
            self.pos.stats.fds+=1

        self.time -= 1

        return (play, result, yds)
    
    def kick(self):
        pd = self.pd1 if self.pos.name == self.team1.name else self.pd2
        val = pd.get_kick_val(self.field.loc)
        self.time-=1
        result = ''
        dist = self.field.loc
        if(val == 1):
            return 'made', dist+17
        
        # Miss
        self.field.set_loc(dist+7)
        return 'missed', dist+17

    def punt(self):
        pd = self.pd1 if self.pos.name == self.team1.name else self.pd2
        val = pd.get_punt_val(self.field.loc)
        self.time-=1
        self.pos.stats.punts+=1
        result = ''
        if(self.field.loc == val):
            result = 'touchback'
            self.field.set_loc(self.field.loc-val)
        elif(val > 1000):
            result = 'muffed punt'
            val-=1100
            self.field.set_loc(self.field.loc-val)
            if(self.field.loc <= 0):
                result = 'touchdown'
        elif(val < -1000):
            result = 'return touchdown'
        else:
            self.field.set_loc(self.field.loc-val)
        return result, val

    def get_score_difference(self):
        if(self.pos.name == self.team1.name):
            return self.pos.score - self.team2.score
        return self.pos.score - self.team1.score

    ### PRINTING STUFF

    def get_score_str(self):
        return '('+str(self.team1.score)+' - '+str(self.team2.score)+')'
    
    def get_down_pos_str(self):      
        posstr = '1st'
        if self.field.down==2:
            posstr = '2nd'
        elif self.field.down==3:
            posstr = '3rd'
        elif self.field.down==4:
            posstr = '4th'
            
        return posstr+' & '+str(self.field.get_distance())
    
    def get_ball_pos_str(self, cap = True):
        posstr = 'mid'
        if self.field.loc>50:
            posstr = 'own'
        elif self.field.loc<50:
            posstr = 'opp'
        
        if cap:
            return 'Ball on '+posstr+' '+str(50-abs(self.field.loc-50))
        
        return 'ball on '+posstr+' '+str(50-abs(self.field.loc-50))    
        

    def get_status_str(self):
        return ('\n'+self.get_score_str()+'|  Time: '+str(self.time)+'\n\n' + self.get_visual_status_str() + '\n\n'
                            +self.get_ball_pos_str()+', '+self.get_down_pos_str()+'\n')
    
    def get_visual_status_str(self):
        str1 = ''
        for i in range(0, self.F_SIZE+1):
            if i%10==0 and i!=0 and i!=100:
                if i/10<=5:
                    str1+='%d'%(i/10)
                else:
                    str1+='%d'%(10-i/10)
            else:
                str1+=' '
        str2 = ''
        if self.pos.name==self.team1.name:
            for i in range(0, self.F_SIZE+1):
                if i==0 or i==100:
                    str2+='|'
                elif i==(abs(100-self.field.loc)):
                    str2+='>'
                elif i != 100 and i==(abs(100-self.field.target)):
                    str2+='x'
                else:
                    str2+='-'
        elif self.pos.name==self.team2.name:
            for i in range(0, self.F_SIZE+1):
                if i==0 or i==100:
                    str2+='|'
                elif i==(self.field.loc):
                    str2+='<'
                elif i != 0 and i==(self.field.target):
                    str2+='x'
                else:
                    str2+='-'
                    
        return str1+'\n'+str2